import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Code } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

const EmbedCodeDialog = ({ open, onOpenChange, agentId, agentName }: EmbedCodeDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchAgentInstructions();
    }
  }, [open, agentId]);

  const fetchAgentInstructions = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;

      // Concatenate all agent instructions
      const instructions = [
        data.quem_eh ? `Quem é: ${data.quem_eh}` : '',
        data.o_que_faz ? `O que faz: ${data.o_que_faz}` : '',
        data.objetivo ? `Objetivo: ${data.objetivo}` : '',
        data.como_deve_responder ? `Como responder: ${data.como_deve_responder}` : '',
        data.instrucoes_agente ? `Instruções: ${data.instrucoes_agente}` : '',
        data.regras_personalizadas ? `Regras: ${data.regras_personalizadas}` : '',
        data.topicos_evitar ? `Tópicos a evitar: ${data.topicos_evitar}` : '',
        data.palavras_evitar ? `Palavras a evitar: ${data.palavras_evitar}` : '',
        data.links_permitidos ? `Links permitidos: ${data.links_permitidos}` : '',
      ].filter(Boolean).join('\n\n');

      setAgentInstructions(instructions);
    } catch (error) {
      console.error('Error fetching agent:', error);
    }
  };

  const generateEmbedCode = () => {
    const escapedName = agentName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const escapedInstructions = agentInstructions.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `<!-- ChatASN Widget - Agente: ${agentName} -->
<div id="chatasn-widget-container"></div>
<script>
(function() {
  // Configurações do Agente
  const AGENT_CONFIG = {
    agentId: "${agentId}",
    agentName: "${escapedName}",
    primaryColor: "#25D366",
    position: "bottom-right", // bottom-right, bottom-left
    greeting: "Olá! Como posso ajudá-lo hoje?",
    placeholder: "Digite sua mensagem...",
    systemPrompt: \`${escapedInstructions}\`
  };

  // Estilos do Widget
  const styles = \`
    #chatasn-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #chatasn-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: \${AGENT_CONFIG.primaryColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #chatasn-toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    #chatasn-chat {
      display: none;
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 380px;
      height: 520px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      overflow: hidden;
      flex-direction: column;
    }
    #chatasn-chat.open { display: flex; }
    #chatasn-header {
      background: \${AGENT_CONFIG.primaryColor};
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #chatasn-header h3 { margin: 0; font-size: 16px; }
    #chatasn-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f5f5f5;
    }
    .chatasn-msg {
      margin-bottom: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      max-width: 80%;
      font-size: 14px;
      line-height: 1.4;
    }
    .chatasn-msg.user {
      background: \${AGENT_CONFIG.primaryColor};
      color: white;
      margin-left: auto;
    }
    .chatasn-msg.bot {
      background: white;
      color: #333;
      border: 1px solid #e0e0e0;
    }
    #chatasn-input-area {
      padding: 12px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 8px;
      background: white;
    }
    #chatasn-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 24px;
      outline: none;
      font-size: 14px;
    }
    #chatasn-send {
      background: \${AGENT_CONFIG.primaryColor};
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  \`;

  // Criar elementos
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widget = document.createElement('div');
  widget.id = 'chatasn-widget';
  widget.innerHTML = \`
    <button id="chatasn-toggle">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </button>
    <div id="chatasn-chat">
      <div id="chatasn-header">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        </div>
        <h3>\${AGENT_CONFIG.agentName}</h3>
      </div>
      <div id="chatasn-messages"></div>
      <div id="chatasn-input-area">
        <input type="text" id="chatasn-input" placeholder="\${AGENT_CONFIG.placeholder}">
        <button id="chatasn-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  \`;
  
  document.getElementById('chatasn-widget-container').appendChild(widget);

  // Lógica do chat
  const toggle = document.getElementById('chatasn-toggle');
  const chat = document.getElementById('chatasn-chat');
  const messages = document.getElementById('chatasn-messages');
  const input = document.getElementById('chatasn-input');
  const send = document.getElementById('chatasn-send');

  let isOpen = false;
  let chatHistory = [];

  toggle.onclick = () => {
    isOpen = !isOpen;
    chat.classList.toggle('open', isOpen);
    if (isOpen && chatHistory.length === 0) {
      addMessage(AGENT_CONFIG.greeting, 'bot');
    }
  };

  function addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = 'chatasn-msg ' + type;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    chatHistory.push({ role: type === 'user' ? 'user' : 'assistant', content: text });
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    addMessage(text, 'user');
    input.value = '';
    
    // Simulação de resposta (integrar com sua API)
    const typingMsg = document.createElement('div');
    typingMsg.className = 'chatasn-msg bot';
    typingMsg.textContent = 'Digitando...';
    messages.appendChild(typingMsg);
    
    // TODO: Integrar com API de IA aqui
    setTimeout(() => {
      typingMsg.remove();
      addMessage('Obrigado pela mensagem! Em breve um atendente entrará em contato.', 'bot');
    }, 1500);
  }

  send.onclick = sendMessage;
  input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
})();
</script>
<!-- Fim ChatASN Widget -->`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    setCopied(true);
    toast({
      title: "Código copiado!",
      description: "Cole o código no seu site para incorporar o agente.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Incorporar no seu Site
          </DialogTitle>
          <DialogDescription>
            Copie o código abaixo e cole no HTML do seu site para adicionar o agente <strong>{agentName}</strong> como um widget de chat.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="relative">
            <Textarea
              readOnly
              value={generateEmbedCode()}
              className="font-mono text-xs h-64 bg-muted/50"
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" /> Copiar
                </>
              )}
            </Button>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg text-sm">
            <p className="font-medium text-amber-400 mb-2">⚠️ Instruções:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Cole o código antes da tag <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> do seu site</li>
              <li>O widget aparecerá no canto inferior direito</li>
              <li>As instruções do agente já estão incluídas no código</li>
              <li>Para integração completa com IA, configure sua API no código</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmbedCodeDialog;
