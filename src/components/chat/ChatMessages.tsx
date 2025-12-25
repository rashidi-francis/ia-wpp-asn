import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Plug, Unplug, Bot, User, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ChatInput } from "./ChatInput";
import type { Conversation, Message } from "@/pages/AgentChats";

interface ChatMessagesProps {
  conversation: Conversation;
  agentName: string;
  onBack: () => void;
  onToggleAgent: (conversationId: string, enabled: boolean) => void;
  showBackButton?: boolean;
}

export const ChatMessages = ({
  conversation,
  agentName,
  onBack,
  onToggleAgent,
  showBackButton = true,
}: ChatMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
  }, [conversation.id]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
    setTimeout(scrollToBottom, 100);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getContactDisplay = () => {
    return conversation.contact_name || conversation.contact_phone || conversation.remote_jid.split("@")[0];
  };

  // Get sender type label and icon
  const getSenderInfo = (message: Message) => {
    const senderType = message.sender_type || (message.is_from_me ? 'ai' : 'client');
    
    switch (senderType) {
      case 'ai':
        return {
          label: 'IA',
          icon: Bot,
          bgClass: 'bg-primary text-primary-foreground',
          alignRight: true,
        };
      case 'human':
        return {
          label: 'Atendente',
          icon: UserCircle,
          bgClass: 'bg-blue-500 text-white',
          alignRight: true,
        };
      case 'client':
      default:
        return {
          label: 'Cliente',
          icon: User,
          bgClass: 'bg-muted',
          alignRight: false,
        };
    }
  };

  const handleSendManualMessage = async (content: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-manual-message', {
        body: {
          conversation_id: conversation.id,
          content,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    } catch (error: any) {
      console.error("Error sending manual message:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
      });
      throw error;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h2 className="font-semibold">{getContactDisplay()}</h2>
            <p className="text-xs text-muted-foreground">{agentName}</p>
            {/* Agent toggle - below name */}
            <button
              onClick={() => onToggleAgent(conversation.id, !conversation.agent_enabled)}
              className={cn(
                "flex items-center gap-1.5 mt-1 text-xs font-medium transition-colors",
                conversation.agent_enabled
                  ? "text-green-600 hover:text-green-700"
                  : "text-red-500 hover:text-red-600"
              )}
            >
              {conversation.agent_enabled ? (
                <>
                  <Plug className="h-3.5 w-3.5" />
                  <span>O Agente está Ligado</span>
                </>
              ) : (
                <>
                  <Unplug className="h-3.5 w-3.5" />
                  <span>O Agente está Desligado</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Carregando mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Nenhuma mensagem nesta conversa</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const senderInfo = getSenderInfo(message);
              const SenderIcon = senderInfo.icon;
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    senderInfo.alignRight ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-4 py-2 shadow-sm",
                      senderInfo.bgClass,
                      senderInfo.alignRight ? "rounded-br-none" : "rounded-bl-none"
                    )}
                  >
                    {/* Sender indicator */}
                    <div className={cn(
                      "flex items-center gap-1.5 mb-1 text-xs font-medium",
                      senderInfo.alignRight 
                        ? "text-inherit opacity-80" 
                        : "text-muted-foreground"
                    )}>
                      <SenderIcon className="h-3 w-3" />
                      <span>{senderInfo.label}</span>
                    </div>
                    
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        senderInfo.alignRight
                          ? "opacity-70"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Manual response input */}
      <ChatInput 
        onSendMessage={handleSendManualMessage}
        placeholder="Digite sua resposta manual..."
      />
    </div>
  );
};
