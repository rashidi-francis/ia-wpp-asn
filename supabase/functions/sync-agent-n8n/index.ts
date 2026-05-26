import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_AGENT_SYNC_WEBHOOK_URL = Deno.env.get('N8N_AGENT_SYNC_WEBHOOK_URL');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

type AgentMedia = {
  url: string;
  description: string | null;
  mediaType: 'image' | 'document';
  mediatype: 'image' | 'document';
  fileName: string;
};

function toSafeFileName(description: string | null | undefined, fallback: string, extension: string): string {
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

  // Use a URL fragment as an n8n parsing hint. It does not change the real download request,
  // but lets Parse Mídia detect PDFs/images even when Google Drive URLs end in /uc?id=...
  return `${url.split('#')[0]}#${encodeURIComponent(fileName)}`;
}

function normalizeMediaUrl(rawUrl: string, fileName?: string): string {
  if (!rawUrl) return rawUrl;
  const url = rawUrl.trim();
  try {
    let normalized = url;
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileMatch) {
      normalized = `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
      return fileName ? appendFileHintIfNeeded(normalized, fileName) : normalized;
    }
    const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (driveOpenMatch) {
      normalized = `https://drive.google.com/uc?export=download&id=${driveOpenMatch[1]}`;
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

// Concatenate all agent instruction fields into a single formatted text block
function buildSystemMessage(
  agent: any,
  photos: AgentMedia[] = [],
  pdfs: AgentMedia[] = [],
): string {
  const sections: string[] = [];

  if (agent.nome) {
    sections.push(`## Nome do Agente\n${agent.nome}`);
  }

  if (agent.quem_eh) {
    sections.push(`## Quem é o Agente\n${agent.quem_eh}`);
  }

  if (agent.o_que_faz) {
    sections.push(`## O que o Agente Faz\n${agent.o_que_faz}`);
  }

  if (agent.objetivo) {
    sections.push(`## Objetivo do Agente\n${agent.objetivo}`);
  }

  if (agent.como_deve_responder) {
    sections.push(`## Como Deve Responder\n${agent.como_deve_responder}`);
  }

  if (agent.instrucoes_agente) {
    sections.push(`## Instruções do Agente\n${agent.instrucoes_agente}`);
  }

  if (agent.topicos_evitar) {
    sections.push(`## Tópicos a Evitar\n${agent.topicos_evitar}`);
  }

  if (agent.palavras_evitar) {
    sections.push(`## Palavras a Evitar\n${agent.palavras_evitar}`);
  }

  if (agent.links_permitidos) {
    sections.push(`## Links Permitidos\n${agent.links_permitidos}`);
  }

  if (agent.regras_personalizadas) {
    sections.push(`## Regras Personalizadas\n${agent.regras_personalizadas}`);
  }

  if (agent.resposta_padrao_erro) {
    sections.push(`## Resposta Padrão de Erro\n${agent.resposta_padrao_erro}`);
  }

  if (agent.resposta_secundaria_erro) {
    sections.push(`## Resposta Secundária de Erro\n${agent.resposta_secundaria_erro}`);
  }

  if (photos.length > 0 || pdfs.length > 0) {
    const lines: string[] = [];
    lines.push('## MÍDIAS DO AGENTE — REGRA CRÍTICA MULTI-TENANT');
    lines.push('Os arquivos abaixo pertencem SOMENTE a este agente/cliente. Quando fizer sentido enviar foto, imagem, apresentação, folder, catálogo ou PDF, envie o arquivo real usando o marcador técnico.');

    if (photos.length > 0) {
      lines.push('\n### Imagens / Fotos disponíveis');
      photos.forEach((p, i) => {
        lines.push(`${i + 1}. ${(p.description || '').trim() || 'imagem sem descrição'}\n   Tipo Evolution: image\n   Nome: ${p.fileName}\n   URL: ${p.url}`);
      });
    }

    if (pdfs.length > 0) {
      lines.push('\n### PDFs / Documentos disponíveis');
      pdfs.forEach((p, i) => {
        lines.push(`${i + 1}. ${(p.description || '').trim() || 'PDF sem descrição'}\n   Tipo Evolution: document\n   Nome: ${p.fileName}\n   URL: ${p.url}`);
      });
    }

    lines.push(`
### COMO RESPONDER QUANDO FOR ENVIAR MÍDIA
- NUNCA envie link, URL crua, "clique aqui" ou "baixar pelo link". Sempre use o marcador técnico abaixo.
- A ação de enviar mídia é escrever exatamente uma linha neste formato, usando SOMENTE uma URL listada acima:
  [[ENVIAR_MIDIA:URL_COMPLETA_DA_LISTA]]
- IMPORTANTE — ORDEM DE ENVIO: o sistema envia primeiro a MÍDIA e DEPOIS o seu texto. Por isso:
  • NUNCA escreva frases no futuro tipo "vou enviar", "segue abaixo a foto", "te mando agora", "veja a imagem abaixo".
  • SEMPRE escreva no passado/presente, como se a mídia já tivesse chegado: "Pronto! Acima está a foto do Produto X", "Aí está o catálogo que você pediu", "Esse é o modelo X, o que achou?".
  • A estrutura ideal da resposta é: [[ENVIAR_MIDIA:URL]] na primeira linha, e depois uma frase curta confirmando o que foi enviado e dando continuidade à conversa.
- Se o cliente pedir "foto", "imagem", "pdf", "apresentação", "folder", "catálogo", "portfólio" ou "tabela" e houver arquivo relacionado acima, responda com o marcador + uma frase pós-envio.
- O marcador é capturado por regex /\\[\\[ENVIAR_MIDIA:(.+?)\\]\\]/g e dispara /message/sendMedia/{instance}.
- Para PDFs/documentos, o n8n envia como mediatype=document. Nunca trate PDF como image.
- Para vários arquivos, use um marcador por linha (todos serão enviados antes do texto).
- Se não existir arquivo relacionado na lista acima, diga que não possui esse arquivo cadastrado; não invente URL.`);

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { agentId } = await req.json();
    console.log(`Syncing agent ${agentId} to n8n for user ${user.id}`);

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (agentError || !agent) {
      console.error('Agent error:', agentError);
      throw new Error('Agent not found or access denied');
    }

    // Get the WhatsApp instance for this agent (if exists)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, phone_number, status')
      .eq('agent_id', agentId)
      .maybeSingle();

    const { data: mediaFiles, error: mediaError } = await supabase
      .from('agent_photos')
      .select('url, description, file_type')
      .eq('agent_id', agentId);

    if (mediaError) {
      console.error('Error fetching agent media:', mediaError);
    }

    const photos = (mediaFiles || [])
      .filter((file: any) => !file.file_type || file.file_type === 'image')
      .map((file: any) => ({
        url: normalizeMediaUrl(file.url, toSafeFileName(file.description, 'imagem-agente', 'jpg')),
        description: file.description || '',
        mediaType: 'image' as const,
        mediatype: 'image' as const,
        fileName: toSafeFileName(file.description, 'imagem-agente', 'jpg'),
      }));

    const pdfs = (mediaFiles || [])
      .filter((file: any) => file.file_type === 'pdf')
      .map((file: any) => ({
        url: normalizeMediaUrl(file.url, toSafeFileName(file.description, 'documento-agente', 'pdf')),
        description: file.description || '',
        mediaType: 'document' as const,
        mediatype: 'document' as const,
        fileName: toSafeFileName(file.description, 'documento-agente', 'pdf'),
      }));

    // Build the concatenated system message with the agent media catalog
    const systemMessage = buildSystemMessage(agent, photos, pdfs);

    // Prepare payload for n8n webhook
    const payload = {
      agent_id: agent.id,
      agent_name: agent.nome,
      user_id: user.id,
      user_email: user.email,
      instance_name: instance?.instance_name || null,
      phone_number: instance?.phone_number || null,
      whatsapp_status: instance?.status || 'disconnected',
      system_message: systemMessage,
      prompt: systemMessage,
      agent_photos: JSON.stringify(photos),
      agent_pdfs: JSON.stringify(pdfs),
      updated_at: new Date().toISOString(),
    };

    console.log('Sending payload to n8n:', JSON.stringify(payload, null, 2));

    // Validate webhook URL is configured
    if (!N8N_AGENT_SYNC_WEBHOOK_URL) {
      console.error('N8N_AGENT_SYNC_WEBHOOK_URL is not configured');
      throw new Error('N8N webhook URL not configured');
    }

    // Send to n8n webhook
    const response = await fetch(N8N_AGENT_SYNC_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', response.status, errorText);
      throw new Error(`Failed to sync with n8n: ${response.status}`);
    }

    const result = await response.json().catch(() => ({}));
    console.log('n8n response:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Agent synced to n8n successfully',
      instance_name: instance?.instance_name || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error syncing agent to n8n:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
