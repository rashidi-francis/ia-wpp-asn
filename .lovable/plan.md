
# ChatASN Multicanal: Meta WhatsApp + Telegram

## Princípio central
Não construir 3 sistemas. Construir **1 motor de atendimento (IA + agenda + follow-up + leitura de áudio/doc/imagem) + conectores de canal**. A IA não precisa saber se a mensagem veio de Evolution, Meta ou Telegram.

Hoje o fluxo é: `Lead → canal → webhook Supabase → grava em whatsapp_conversations/messages → n8n → resposta`. Vamos manter **exatamente** esse fluxo, só adicionando webhooks de entrada novos e uma saída que escolhe o provedor certo.

```text
                 ┌─ evolution-webhook ─┐
Lead (WhatsApp QR)┤                     │
Lead (Meta WABA) ─┤→ normaliza p/ o    │→ whatsapp_conversations
Lead (Telegram) ──┘  MESMO formato     │→ whatsapp_messages
                                        │→ n8n (mesmo payload, + provider)
                                        ▼
                              dispatch-message (NOVO)
                              escolhe: Evolution | Meta | Telegram
```

## O que já existe e será reaproveitado
- Tabela `meta_whatsapp_instances` (WABA, phone_number_id, access_token, webhook_verify_token) — já pronta.
- `MetaApiDialog` + `meta-whatsapp-api` (conectar/validar/desconectar) — já pronto.
- Tabelas `whatsapp_conversations` / `whatsapp_messages` — servem para os 3 canais (são o "inbox" unificado).
- Toda a esteira de IA/agenda/follow-up no n8n — sem alteração de lógica.

## O que falta (o trabalho real)

### Fase 1 — Meta WhatsApp funcionando de verdade (prioridade do cliente sério)
1. **`meta-whatsapp-webhook` (edge function nova, verify_jwt=false)**
   - `GET`: responde o desafio `hub.challenge` da Meta usando o `webhook_verify_token` da instância.
   - `POST`: recebe mensagens (texto, imagem, áudio, documento), identifica a instância pelo `phone_number_id`, normaliza e grava em `whatsapp_conversations`/`whatsapp_messages` no **mesmo formato** do Evolution, e encaminha pro n8n com `provider: "meta_cloud"`.
   - Validação de assinatura `X-Hub-Signature-256`.
2. **Mídia da Meta**: baixar via Graph API (media id → URL temporária → bytes) e subir pro storage, reusando o mesmo padrão de áudio (Groq) e leitura de doc/imagem que já existe.
3. **Envio pela Meta** dentro do novo `dispatch-message`: texto agora; janela de 24h + fallback de template depois (Fase 4).
4. **Resolver de saída**: o `evolution-webhook` (reply via HTTP do n8n) e o `send-manual-message` passam a chamar `dispatch-message`, que olha qual provedor a conversa usa e envia pelo canal certo.

### Fase 2 — Telegram (rápido, prova a arquitetura)
1. Tabela nova `telegram_instances` (agent_id, bot_token, bot_username, status) com GRANTs + RLS por dono do agente.
2. **`telegram-webhook` (edge function nova, verify_jwt=false)** via connector gateway do Telegram (sem expor token): recebe update, normaliza, grava no inbox unificado, encaminha pro n8n com `provider: "telegram"`.
3. Envio pelo `dispatch-message` (sendMessage / sendPhoto / getFile+download).
4. UI: novo card "Telegram Bot IA" com campo de token + "Testar conexão" + "Ativar webhook" + status.

### Fase 3 — UI multicanal limpa
- Transformar a página de conexão do agente em "Canais", com os 3 conectores lado a lado (WhatsApp QR, WhatsApp Oficial Meta, Telegram), cada um com seu status. Visual neon/futurista no padrão atual.
- Badge no inbox indicando de qual canal veio cada conversa.

### Fase 4 — Robustez Meta (evitar "a IA falhou")
- Gerenciador de templates + aviso de janela 24h encerrada + fallback "selecione um template".
- Logs de erro da Meta + status de qualidade do número.

## Detalhes técnicos
- **Marcador de canal**: adicionar coluna `provider` (text, default `'evolution'`) em `whatsapp_conversations` para o `dispatch-message` saber por onde responder. Migration com GRANTs.
- **dispatch-message (edge function nova)**: recebe `conversation_id` + `content` (+tipo/mídia), lê o `provider` da conversa, e envia por Evolution / Meta Graph API / Telegram. Centraliza toda a saída — `send-manual-message` e a resposta do n8n passam a usar ele.
- **n8n**: o payload pro n8n ganha `provider`. Se o seu n8n hoje responde chamando a Evolution direto ("respond immediately"), para Meta/Telegram ele precisa devolver a resposta no HTTP (ou chamar `dispatch-message`), porque Evolution não envia por número Meta/Telegram. **Essa parte exige um ajuste no workflow do n8n** (eu preparo o endpoint e te passo o nó exato).
- **Telegram**: usa o conector nativo (gateway Lovable), sem guardar o token cru em URL.

## Dependências externas (fora do código)
- Meta: o cliente precisa de WABA + número registrado na Cloud API + token de sistema (a tela já coleta isso).
- Telegram: token do BotFather.
- n8n: pequeno ajuste no nó de resposta para respeitar o `provider`.

## Ordem sugerida de execução
1. Telegram (Fase 2) — rápido e valida o multicanal de ponta a ponta.
2. Meta recebimento+envio de texto (Fase 1) — resolve o problema grave de bloqueio.
3. UI de Canais (Fase 3).
4. Templates/janela 24h da Meta (Fase 4).
