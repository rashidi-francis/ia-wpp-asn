// ============================================================================
// ChatASN — Motor multicanal compartilhado (Evolution / Meta Cloud / Telegram)
// ----------------------------------------------------------------------------
// Mantém UMA implementação da normalização de mensagens, construção do payload
// do n8n e do envio por canal. Usado por telegram-webhook, meta-whatsapp-webhook
// e dispatch-message. O evolution-webhook permanece independente (já em produção).
// ============================================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export type Provider = 'evolution' | 'meta_cloud' | 'telegram';

export type AgentMedia = {
  url: string;
  description: string | null;
  mediaType: 'image' | 'document';
  mediatype: 'image' | 'document';
  fileName: string;
};

// ---------------------------------------------------------------------------
// Follow-up: mesmo cálculo do evolution-webhook (quiet hours 20h-9h BRT + domingo)
// ---------------------------------------------------------------------------
export function computeFollowupDueAt(delayMs: number): Date {
  const raw = new Date(Date.now() + delayMs);
  const brt = new Date(raw.getTime() - 3 * 60 * 60 * 1000);
  const hour = brt.getUTCHours();
  const weekday = brt.getUTCDay();

  let due = raw;
  if (weekday === 0 || hour >= 20 || hour < 9) {
    const next = new Date(raw);
    if (hour >= 20) next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(12, 0, 0, 0); // 9h BRT = 12h UTC
    const nbrt = new Date(next.getTime() - 3 * 60 * 60 * 1000);
    if (nbrt.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);
    due = next;
  }
  return due;
}

// ---------------------------------------------------------------------------
// Normalização de URLs de mídia (Google Drive / Dropbox) — igual ao evolution-webhook
// ---------------------------------------------------------------------------
export function toSafeFileName(description: string | null | undefined, fallback: string, extension: string): string {
  const base = (description || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
    .toLowerCase() || fallback;
  return `${base}.${extension}`;
}

function appendFileHintIfNeeded(url: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || url.toLowerCase().includes(`.${ext}`)) return url;
  return `${url.split('#')[0]}#${encodeURIComponent(fileName)}`;
}

export function normalizeMediaUrl(rawUrl: string, fileName?: string, kind: 'image' | 'document' = 'document'): string {
  if (!rawUrl) return rawUrl;
  const url = rawUrl.trim();
  try {
    let normalized = url;
    let driveId: string | null = null;
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    const driveUcMatch = url.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
    if (driveFileMatch) driveId = driveFileMatch[1];
    else if (driveOpenMatch) driveId = driveOpenMatch[1];
    else if (driveUcMatch) driveId = driveUcMatch[1];

    if (driveId) {
      if (kind === 'image') return `https://lh3.googleusercontent.com/d/${driveId}=w2000`;
      normalized = `https://drive.google.com/uc?export=download&id=${driveId}`;
      return fileName ? appendFileHintIfNeeded(normalized, fileName) : normalized;
    }
    if (url.includes('dropbox.com')) {
      normalized = url.replace(/([?&])dl=0/, '$1dl=1').replace(/\?$/, '');
      return fileName ? appendFileHintIfNeeded(normalized, fileName) : normalized;
    }
    return fileName ? appendFileHintIfNeeded(normalized, fileName) : normalized;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// System message (prompt) — igual ao evolution-webhook (paridade entre canais)
// ---------------------------------------------------------------------------
export function buildSystemMessage(agent: any, photos: AgentMedia[] = [], pdfs: AgentMedia[] = []): string {
  const sections: string[] = [];
  if (agent.nome) sections.push(`## Nome do Agente\n${agent.nome}`);
  if (agent.quem_eh) sections.push(`## Quem é o Agente\n${agent.quem_eh}`);
  if (agent.o_que_faz) sections.push(`## O que o Agente Faz\n${agent.o_que_faz}`);
  if (agent.objetivo) sections.push(`## Objetivo do Agente\n${agent.objetivo}`);
  if (agent.como_deve_responder) sections.push(`## Como Deve Responder\n${agent.como_deve_responder}`);
  if (agent.instrucoes_agente) sections.push(`## Instruções do Agente\n${agent.instrucoes_agente}`);
  if (agent.topicos_evitar) sections.push(`## Tópicos a Evitar\n${agent.topicos_evitar}`);
  if (agent.palavras_evitar) sections.push(`## Palavras a Evitar\n${agent.palavras_evitar}`);
  if (agent.links_permitidos) sections.push(`## Links Permitidos\n${agent.links_permitidos}`);
  if (agent.regras_personalizadas) sections.push(`## Regras Personalizadas\n${agent.regras_personalizadas}`);
  if (agent.resposta_padrao_erro) sections.push(`## Resposta Padrão de Erro\n${agent.resposta_padrao_erro}`);
  if (agent.resposta_secundaria_erro) sections.push(`## Resposta Secundária de Erro\n${agent.resposta_secundaria_erro}`);

  // Regra global ChatASN: respostas curtas, uma por vez (mesma regra do sync-agent-n8n)
  sections.push(
    '## Estilo de Resposta (OBRIGATÓRIO)\n' +
    'NUNCA envie "textão". Cada resposta deve ter NO MÁXIMO 500 caracteres. ' +
    'Envie UMA mensagem por vez e ESPERE o cliente responder antes de mandar a próxima.',
  );

  if (photos.length > 0 || pdfs.length > 0) {
    const lines: string[] = [];
    lines.push('## Mídias Disponíveis para Envio');
    lines.push('Você possui os arquivos abaixo (imagens e/ou PDFs) e pode enviá-los diretamente ao cliente quando ele pedir OU quando for natural/útil enviar.');
    if (photos.length > 0) {
      lines.push('\n### Imagens / Fotos');
      photos.forEach((p, i) => {
        const desc = (p.description || '').trim() || 'sem descrição';
        lines.push(`${i + 1}. ${desc}\n   Tipo: image\n   Nome: ${p.fileName}\n   URL: ${p.url}`);
      });
    }
    if (pdfs.length > 0) {
      lines.push('\n### PDFs / Documentos');
      pdfs.forEach((p, i) => {
        const desc = (p.description || '').trim() || 'sem descrição';
        lines.push(`${i + 1}. ${desc}\n   Tipo: document\n   Nome: ${p.fileName}\n   URL: ${p.url}`);
      });
    }
    lines.push(`
### Regras OBRIGATÓRIAS de envio de mídia
1. NUNCA envie a URL crua, nem "clique aqui". O cliente NÃO deve ver link nenhum.
2. Para enviar o arquivo em si, escreva em uma linha SEPARADA, exatamente neste formato:
   [[ENVIAR_MIDIA:URL_COMPLETA_AQUI]]
3. Use SOMENTE URLs do catálogo acima. Se não houver arquivo correspondente, diga que não possui — NÃO invente URL.`);
    sections.push(lines.join('\n'));
  }
  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Busca dados do agente para montar o payload do n8n (prompt, fotos, pdfs, calendar)
// ---------------------------------------------------------------------------
export async function buildAgentN8nExtras(supabase: any, agentId: string) {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single();
  const { data: calendarSettings } = await supabase
    .from('agent_calendar_settings').select('*').eq('agent_id', agentId).maybeSingle();
  const { data: agentPhotos } = await supabase
    .from('agent_photos').select('url, description, file_type').eq('agent_id', agentId);
  const { data: agentPdfs } = await supabase
    .from('agent_photos').select('url, description').eq('agent_id', agentId).eq('file_type', 'pdf');

  const photosForPrompt: AgentMedia[] = (agentPhotos || [])
    .filter((p: any) => !p.file_type || p.file_type === 'image')
    .map((p: any) => ({
      url: normalizeMediaUrl(p.url, toSafeFileName(p.description, 'imagem-agente', 'jpg'), 'image'),
      description: p.description || '',
      mediaType: 'image', mediatype: 'image',
      fileName: toSafeFileName(p.description, 'imagem-agente', 'jpg'),
    }));
  const pdfsForPrompt: AgentMedia[] = (agentPdfs || []).map((p: any) => ({
    url: normalizeMediaUrl(p.url, toSafeFileName(p.description, 'documento-agente', 'pdf')),
    description: p.description || '',
    mediaType: 'document', mediatype: 'document',
    fileName: toSafeFileName(p.description, 'documento-agente', 'pdf'),
  }));

  return {
    agent,
    prompt: agent ? buildSystemMessage(agent, photosForPrompt, pdfsForPrompt) : '',
    photosJson: JSON.stringify(photosForPrompt),
    pdfsJson: JSON.stringify(pdfsForPrompt),
    calendar_enabled: calendarSettings?.enabled && calendarSettings?.google_refresh_token ? 'true' : 'false',
    calendar_refresh_token: calendarSettings?.google_refresh_token || '',
    calendar_id: calendarSettings?.google_calendar_id || 'primary',
  };
}

// ---------------------------------------------------------------------------
// Upsert da conversa + grava mensagem recebida (mesma lógica de follow-up)
// ---------------------------------------------------------------------------
export async function saveIncomingMessage(
  supabase: any,
  args: {
    agentId: string;
    provider: Provider;
    remoteJid: string;
    contactName: string | null;
    contactPhone: string | null;
    content: string;
    messageId?: string | null;
    messageType?: string;
  },
): Promise<{ conversationId: string; agentEnabled: boolean } | null> {
  try {
    const { agentId, provider, remoteJid, contactName, contactPhone, content } = args;
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    let conversationId: string;
    let agentEnabled = true;

    if (existing) {
      conversationId = existing.id;
      agentEnabled = existing.agent_enabled ?? true;
      const updateData: any = {
        last_message: content,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider,
        // lead respondeu → cancela follow-up
        unread_count: (existing.unread_count || 0) + 1,
        last_message_from: 'lead',
        status: 'open',
        followup_due_at: null,
        followup_sent: false,
        followup_count: 0,
      };
      if (contactName && contactName !== existing.contact_name) updateData.contact_name = contactName;
      await supabase.from('whatsapp_conversations').update(updateData).eq('id', conversationId);
    } else {
      const { data: created, error } = await supabase
        .from('whatsapp_conversations')
        .insert({
          agent_id: agentId,
          remote_jid: remoteJid,
          provider,
          contact_name: contactName,
          contact_phone: contactPhone,
          last_message: content,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
          agent_enabled: true,
          status: 'open',
          last_message_from: 'lead',
          followup_due_at: null,
          followup_sent: false,
          followup_count: 0,
        })
        .select()
        .single();
      if (error || !created) {
        console.error('saveIncomingMessage: error creating conversation', error);
        return null;
      }
      conversationId = created.id;
    }

    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      message_id: args.messageId || null,
      content,
      is_from_me: false,
      message_type: args.messageType || 'text',
      sender_type: 'client',
    });

    return { conversationId, agentEnabled };
  } catch (e) {
    console.error('saveIncomingMessage error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Envia o payload pro n8n e devolve a resposta de texto (se houver no HTTP)
// ---------------------------------------------------------------------------
export async function forwardToN8n(n8nBody: Record<string, any>): Promise<string | null> {
  const N8N_MESSAGES_WEBHOOK_URL = Deno.env.get('N8N_MESSAGES_WEBHOOK_URL');
  if (!N8N_MESSAGES_WEBHOOK_URL) {
    console.error('N8N_MESSAGES_WEBHOOK_URL is not configured');
    return null;
  }
  try {
    const response = await fetch(N8N_MESSAGES_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nBody),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error('n8n webhook error:', response.status, raw);
      return null;
    }
    const trimmed = raw?.trim?.() ?? '';
    let replyText: string | null = null;
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        replyText =
          (typeof parsed?.reply === 'string' && parsed.reply) ||
          (typeof parsed?.text === 'string' && parsed.text) ||
          (typeof parsed?.message === 'string' && parsed.message) ||
          null;
      } catch {
        replyText = trimmed;
      }
    }
    if (replyText) {
      const lower = replyText.toLowerCase().trim();
      const n8nStatusPatterns = [
        'workflow was started', 'workflow has started', 'workflow started',
        'workflow was executed', 'workflow executed', 'message received',
        'webhook received', 'accepted', 'ok',
      ];
      if (n8nStatusPatterns.some((p) => lower === p || lower.startsWith(p))) {
        console.log(`Ignoring n8n status response: "${replyText.substring(0, 80)}"`);
        replyText = null;
      }
    }
    return replyText;
  } catch (e) {
    console.error('forwardToN8n error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// ENVIO POR CANAL (resolve provider e dispara pelo conector certo)
// ---------------------------------------------------------------------------
export async function sendViaProvider(
  supabase: any,
  conversation: { id: string; agent_id: string; provider: string; remote_jid: string; contact_phone: string | null },
  content: string,
): Promise<{ success: boolean; messageId: string | null; error?: string }> {
  const provider = (conversation.provider || 'evolution') as Provider;

  if (provider === 'telegram') {
    const { data: inst } = await supabase
      .from('telegram_instances').select('*').eq('agent_id', conversation.agent_id).maybeSingle();
    if (!inst?.bot_token) return { success: false, messageId: null, error: 'Telegram bot não configurado' };
    const chatId = conversation.remote_jid.replace(/^tg:/, '');
    return await sendTelegramReply(inst.bot_token, chatId, content);
  }


  if (provider === 'meta_cloud') {
    const { data: inst } = await supabase
      .from('meta_whatsapp_instances').select('*').eq('agent_id', conversation.agent_id).maybeSingle();
    if (!inst?.access_token || !inst?.phone_number_id) {
      return { success: false, messageId: null, error: 'Instância Meta não configurada' };
    }
    const to = (conversation.contact_phone || conversation.remote_jid.split('@')[0]).replace(/\D/g, '');
    return await sendMetaText(inst.phone_number_id, inst.access_token, to, content);
  }

  // default: evolution
  const { data: inst } = await supabase
    .from('whatsapp_instances').select('*').eq('agent_id', conversation.agent_id).eq('status', 'connected').maybeSingle();
  if (!inst?.instance_name) return { success: false, messageId: null, error: 'Instância WhatsApp não conectada' };
  const number = conversation.remote_jid.split('@')[0];
  return await sendEvolutionText(inst.instance_name, number, content);
}

export async function sendEvolutionText(instanceName: string, number: string, text: string) {
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return { success: false, messageId: null, error: 'Evolution API não configurada' };
  }
  const cleanUrl = EVOLUTION_API_URL.replace(/\/+$/, '').replace(/\/manager$/i, '');
  const resp = await fetch(`${cleanUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text, options: { presence: 'composing', linkPreview: true } }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    console.error('Evolution sendText error:', resp.status, body);
    return { success: false, messageId: null, error: 'Falha no envio via Evolution' };
  }
  let messageId: string | null = null;
  try { const p = JSON.parse(body); messageId = p?.key?.id || p?.id || null; } catch { /* ignore */ }
  return { success: true, messageId };
}

export async function sendMetaText(phoneNumberId: string, accessToken: string, to: string, text: string) {
  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = (data as any)?.error?.message || `HTTP ${resp.status}`;
    console.error('Meta sendText error:', resp.status, JSON.stringify(data));
    return { success: false, messageId: null, error: err };
  }
  const messageId = (data as any)?.messages?.[0]?.id || null;
  return { success: true, messageId };
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !(data as any)?.ok) {
    const err = (data as any)?.description || `HTTP ${resp.status}`;
    console.error('Telegram sendMessage error:', resp.status, JSON.stringify(data));
    return { success: false, messageId: null, error: err };
  }
  const messageId = (data as any)?.result?.message_id ? String((data as any).result.message_id) : null;
  return { success: true, messageId };
}

// ---------------------------------------------------------------------------
// Telegram: resolve a URL pública de download de um file_id (áudio/voz/etc).
// A URL retornada (https://api.telegram.org/file/bot<token>/<path>) é
// diretamente baixável — o n8n consegue buscá-la no nó "Download Audio".
// ---------------------------------------------------------------------------
export async function getTelegramFileUrl(botToken: string, fileId: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const data = await resp.json().catch(() => ({}));
    const filePath = (data as any)?.result?.file_path;
    if (!resp.ok || !(data as any)?.ok || !filePath) {
      console.error('Telegram getFile error:', resp.status, JSON.stringify(data).substring(0, 200));
      return null;
    }
    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  } catch (e) {
    console.error('getTelegramFileUrl error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Transcrição de áudio via Groq Whisper (usado pelo Telegram).
// Baixa os bytes do áudio e transcreve direto no backend, evitando depender
// do nó "Download Audio" do n8n (que é específico da Evolution/WhatsApp).
// Retorna o texto transcrito ou null em caso de falha.
// ---------------------------------------------------------------------------
export async function transcribeAudioFromUrl(audioUrl: string): Promise<string | null> {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not configured; cannot transcribe Telegram audio');
    return null;
  }

  const media = await fetchMediaBytes(audioUrl);
  if (!media) {
    console.error('transcribeAudioFromUrl: could not download audio bytes', audioUrl);
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const form = new FormData();
      const ext = (media.contentType.includes('mp3') && 'mp3')
        || (media.contentType.includes('mp4') && 'm4a')
        || (media.contentType.includes('wav') && 'wav')
        || 'ogg';
      form.append('file', blobFromBytes(media.bytes, media.contentType || 'audio/ogg'), `audio.${ext}`);
      form.append('model', 'whisper-large-v3');
      form.append('language', 'pt');
      form.append('response_format', 'json');

      const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: form,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error('Groq transcription error:', resp.status, JSON.stringify(data).substring(0, 200));
      } else {
        const text = (data as any)?.text;
        if (typeof text === 'string' && text.trim()) return text.trim();
        console.error('Groq transcription: empty text response');
        return null;
      }
    } catch (e) {
      console.error(`transcribeAudioFromUrl attempt ${attempt + 1} failed:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return null;
}




// ---------------------------------------------------------------------------
// Mídia: extrai marcadores [[ENVIAR_MIDIA:URL]] do texto da IA
// ---------------------------------------------------------------------------
const MEDIA_MARKER_RE = /\[+\s*ENVIAR_MIDIA\s*:\s*([^\]]+?)\s*\]+/gi;

export function extractMediaMarkers(text: string): { cleanText: string; mediaUrls: string[] } {
  const mediaUrls: string[] = [];
  if (!text) return { cleanText: '', mediaUrls };
  let m: RegExpExecArray | null;
  MEDIA_MARKER_RE.lastIndex = 0;
  while ((m = MEDIA_MARKER_RE.exec(text)) !== null) {
    const url = (m[1] || '').trim();
    if (url) mediaUrls.push(url);
  }
  const cleanText = text
    .replace(MEDIA_MARKER_RE, '')
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { cleanText, mediaUrls };
}

export function hasMediaMarker(text: string): boolean {
  MEDIA_MARKER_RE.lastIndex = 0;
  return MEDIA_MARKER_RE.test(text || '');
}

function normalizeSearchText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const MEDIA_STOPWORDS = new Set([
  'para', 'como', 'com', 'uma', 'por', 'favor', 'voce', 'vocs', 'vcs', 'site', 'plataforma',
  'cliente', 'imagem', 'foto', 'print', 'mostrar', 'enviar', 'envia', 'vou', 'fazer', 'passo',
  'onde', 'esta', 'esse', 'essa', 'isso', 'aqui', 'agora', 'pelo', 'pela', 'dele', 'dela',
]);

function parseAgentMediaList(json: string | undefined | null): AgentMedia[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url) : [];
  } catch {
    return [];
  }
}

export function appendRelevantMediaMarkerIfMissing(
  replyText: string,
  contextText: string,
  photosJson?: string,
  pdfsJson?: string,
): string {
  if (!replyText || hasMediaMarker(replyText)) return replyText;

  const context = normalizeSearchText(`${contextText}\n${replyText}`);
  const asksForMedia = /\b(imagem|foto|print|mostr|anex|envia|enviar|vou enviar|veja|abaixo)\b/i.test(context);
  if (!asksForMedia) return replyText;

  const catalog = [...parseAgentMediaList(photosJson), ...parseAgentMediaList(pdfsJson)];
  if (catalog.length === 0) return replyText;

  const tokens = Array.from(new Set(
    context
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !MEDIA_STOPWORDS.has(token)),
  ));

  let best: AgentMedia | null = null;
  let bestScore = 0;
  for (const item of catalog) {
    const haystack = normalizeSearchText(`${item.description || ''} ${item.fileName || ''} ${item.url || ''}`);
    let score = 0;
    if (context.includes('adicionar saldo') && haystack.includes('adicionar saldo')) score += 25;
    if (context.includes('saldo') && haystack.includes('saldo')) score += 12;
    if (context.includes('pedido') && haystack.includes('pedido')) score += 8;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length >= 6 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (!best || bestScore < 4) return replyText;
  return `${replyText.trim()}\n\n[[ENVIAR_MIDIA:${best.url}]]`;
}

function isImageUrl(url: string): boolean {
  const clean = url.split(/[?#]/)[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(clean)
    || url.includes('lh3.googleusercontent.com');
}

// Baixa os bytes da mídia (com retry) para subir direto ao Telegram via multipart.
// Enviar bytes é MUITO mais confiável do que passar a URL e deixar o Telegram baixar
// (ex.: .webp em alguns hosts faz o Telegram resetar a conexão / falhar o download).
async function fetchMediaBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (ChatASN)' } });
      if (!resp.ok) {
        console.error('fetchMediaBytes HTTP error:', resp.status, url);
      } else {
        const buf = new Uint8Array(await resp.arrayBuffer());
        const contentType = resp.headers.get('content-type') || 'application/octet-stream';
        if (buf.byteLength > 0) return { bytes: buf, contentType };
      }
    } catch (e) {
      console.error(`fetchMediaBytes attempt ${attempt + 1} failed:`, (e as Error).message, url);
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}

function fileNameFromUrl(url: string, fallbackExt: string): string {
  const clean = url.split(/[?#]/)[0];
  const last = clean.substring(clean.lastIndexOf('/') + 1);
  return last && last.includes('.') ? last : `arquivo.${fallbackExt}`;
}

function blobFromBytes(bytes: Uint8Array, contentType: string): Blob {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: contentType });
}

// POST multipart para o Telegram com retry em erros de conexão.
async function telegramUpload(
  botToken: string, method: 'sendPhoto' | 'sendDocument',
  chatId: string, field: 'photo' | 'document', blob: Blob, fileName: string, caption?: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const form = new FormData();
      form.append('chat_id', chatId);
      if (caption) form.append('caption', caption);
      form.append(field, blob, fileName);
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST', body: form,
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && (data as any)?.ok) {
        const messageId = (data as any)?.result?.message_id ? String((data as any).result.message_id) : null;
        return { success: true, messageId };
      }
      const err = (data as any)?.description || `HTTP ${resp.status}`;
      console.error(`Telegram ${method} error:`, resp.status, JSON.stringify(data));
      // Erro do lado do Telegram (não de conexão): não adianta repetir
      return { success: false, messageId: null, error: err };
    } catch (e) {
      console.error(`Telegram ${method} attempt ${attempt + 1} connection error:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return { success: false, messageId: null, error: 'connection error' };
}

export async function sendTelegramPhoto(botToken: string, chatId: string, photoUrl: string, caption?: string) {
  const media = await fetchMediaBytes(photoUrl);
  if (!media) {
    // Último recurso: deixa o Telegram tentar baixar a URL
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption || undefined }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (resp?.ok && (data as any)?.ok) {
      return { success: true, messageId: String((data as any).result.message_id) };
    }
    return { success: false, messageId: null, error: 'Falha ao baixar imagem' };
  }
  const fileName = fileNameFromUrl(photoUrl, 'jpg');
  const blob = blobFromBytes(media.bytes, media.contentType);
  const sent = await telegramUpload(botToken, 'sendPhoto', chatId, 'photo', blob, fileName, caption);
  // Telegram pode rejeitar alguns formatos (ex.: webp) como foto → cai pra documento
  if (!sent.success) {
    console.log('sendPhoto falhou, tentando como documento:', fileName);
    return await telegramUpload(botToken, 'sendDocument', chatId, 'document', blob, fileName, caption);
  }
  return sent;
}

export async function sendTelegramDocument(botToken: string, chatId: string, docUrl: string, caption?: string) {
  const media = await fetchMediaBytes(docUrl);
  if (!media) {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, document: docUrl, caption: caption || undefined }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => ({})) : {};
    if (resp?.ok && (data as any)?.ok) {
      return { success: true, messageId: String((data as any).result.message_id) };
    }
    return { success: false, messageId: null, error: 'Falha ao baixar documento' };
  }
  const fileName = fileNameFromUrl(docUrl, 'pdf');
  const blob = blobFromBytes(media.bytes, media.contentType);
  return await telegramUpload(botToken, 'sendDocument', chatId, 'document', blob, fileName, caption);
}

// Envia a resposta completa da IA pelo Telegram: texto + mídias (foto/documento).
// Lê os marcadores [[ENVIAR_MIDIA:URL]] e dispara o arquivo real ao invés da URL crua.
export async function sendTelegramReply(botToken: string, chatId: string, content: string) {
  const { cleanText, mediaUrls } = extractMediaMarkers(content);

  let messageId: string | null = null;

  // 1) Texto primeiro (se houver), para dar contexto antes da mídia
  if (cleanText) {
    const sent = await sendTelegramMessage(botToken, chatId, cleanText);
    if (sent.success) messageId = sent.messageId;
  }

  // 2) Cada mídia como foto (imagem) ou documento (PDF/outros)
  for (const rawUrl of mediaUrls) {
    const isImage = isImageUrl(rawUrl);
    const url = normalizeMediaUrl(rawUrl, undefined, isImage ? 'image' : 'document');
    const sent = isImage
      ? await sendTelegramPhoto(botToken, chatId, url)
      : await sendTelegramDocument(botToken, chatId, url);
    if (sent.success && !messageId) messageId = sent.messageId;
  }

  // Se não havia texto nem mídia, garante envio do conteúdo bruto
  if (!cleanText && mediaUrls.length === 0) {
    return await sendTelegramMessage(botToken, chatId, content);
  }

  return { success: true, messageId };
}



// ---------------------------------------------------------------------------
// Salva resposta da IA e atualiza a conversa (agenda follow-up #1)
// ---------------------------------------------------------------------------
export async function saveOutgoingMessage(
  supabase: any,
  conversationId: string,
  content: string,
  messageId: string | null,
  senderType: 'ai' | 'human' = 'ai',
) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    message_id: messageId,
    content,
    is_from_me: true,
    message_type: 'text',
    sender_type: senderType,
  });

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('followup_due_at, followup_sent, followup_count')
    .eq('id', conversationId)
    .maybeSingle();

  const updateData: any = {
    last_message: content,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Só a IA agenda follow-up; mensagem humana não inicia sequência automática
  if (senderType === 'ai' && conv) {
    const alreadyScheduled = conv.followup_due_at != null;
    const alreadySent = conv.followup_sent === true;
    const countReached = (conv.followup_count || 0) >= 3;
    updateData.last_message_from = 'ai';
    updateData.status = 'open';
    if (!alreadyScheduled && !alreadySent && !countReached) {
      updateData.followup_due_at = computeFollowupDueAt(10 * 60 * 1000).toISOString();
      updateData.followup_sent = false;
    }
  }

  await supabase.from('whatsapp_conversations').update(updateData).eq('id', conversationId);
}
