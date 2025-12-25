import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatList } from "@/components/chat/ChatList";
import { ChatMessages } from "@/components/chat/ChatMessages";
import type { Session } from "@supabase/supabase-js";

export interface Conversation {
  id: string;
  agent_id: string;
  remote_jid: string;
  contact_name: string | null;
  contact_phone: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  agent_enabled: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  message_id: string | null;
  content: string;
  is_from_me: boolean;
  message_type: string;
  sender_type?: 'client' | 'ai' | 'human';
  created_at: string;
}

const AgentChats = () => {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user && agentId) {
      loadData();
    }
  }, [session, agentId]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `agent_id=eq.${agentId}`
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  const loadData = async () => {
    try {
      // Load agent name
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("nome")
        .eq("id", agentId)
        .single();

      if (agentError) throw agentError;
      setAgentName(agent?.nome || "Sem nome");

      await loadConversations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("agent_id", agentId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    setConversations(data || []);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBack = () => {
    if (selectedConversation && isMobile) {
      setSelectedConversation(null);
    } else {
      navigate("/dashboard");
    }
  };

  const handleToggleAgent = async (conversationId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ agent_enabled: enabled })
        .eq("id", conversationId);

      if (error) throw error;

      // Update local state
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, agent_enabled: enabled } : c)
      );
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, agent_enabled: enabled } : null);
      }

      toast({
        title: enabled ? "Agente ligado" : "Agente desligado",
        description: `O agente foi ${enabled ? "ativado" : "desativado"} para esta conversa.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mobile: Show only list or only chat
  if (isMobile) {
    if (selectedConversation) {
      return (
        <div className="h-screen flex flex-col bg-background">
          <ChatMessages
            conversation={selectedConversation}
            agentName={agentName}
            onBack={handleBack}
            onToggleAgent={handleToggleAgent}
          />
        </div>
      );
    }

    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{agentName}</h1>
            <p className="text-sm text-muted-foreground">Conversas</p>
          </div>
        </header>
        <ChatList
          conversations={conversations}
          selectedId={null}
          onSelect={handleSelectConversation}
        />
      </div>
    );
  }

  // Desktop: Side by side layout
  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar with conversations list */}
      <div className="w-80 border-r border-border flex flex-col">
        <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{agentName}</h1>
            <p className="text-sm text-muted-foreground">Conversas</p>
          </div>
        </header>
        <ChatList
          conversations={conversations}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatMessages
            conversation={selectedConversation}
            agentName={agentName}
            onBack={() => setSelectedConversation(null)}
            onToggleAgent={handleToggleAgent}
            showBackButton={false}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa para visualizar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChats;
