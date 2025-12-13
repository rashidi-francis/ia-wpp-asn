import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Plug, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="font-semibold">{getContactDisplay()}</h2>
            <p className="text-xs text-muted-foreground">{agentName}</p>
          </div>
        </div>

        {/* Agent toggle */}
        <button
          onClick={() => onToggleAgent(conversation.id, !conversation.agent_enabled)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            conversation.agent_enabled
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              : "text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          )}
        >
          {conversation.agent_enabled ? (
            <>
              <Plug className="h-4 w-4" />
              <span>O Agente está Ligado</span>
            </>
          ) : (
            <>
              <Unplug className="h-4 w-4" />
              <span>O Agente está Desligado</span>
            </>
          )}
        </button>
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
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.is_from_me ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-4 py-2 shadow-sm",
                    message.is_from_me
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted rounded-bl-none"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      message.is_from_me
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
