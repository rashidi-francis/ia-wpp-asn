import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/pages/AgentChats";

interface ChatListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

export const ChatList = ({ conversations, selectedId, onSelect }: ChatListProps) => {
  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getContactDisplay = (conversation: Conversation) => {
    return conversation.contact_name || conversation.contact_phone || conversation.remote_jid.split("@")[0];
  };

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <p className="text-center text-sm">Nenhuma conversa ainda</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={cn(
              "w-full p-4 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors",
              selectedId === conversation.id && "bg-muted"
            )}
          >
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(conversation.contact_name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {getContactDisplay(conversation)}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatTime(conversation.last_message_at)}
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message || "Sem mensagens"}
                </p>
                {conversation.unread_count > 0 && (
                  <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center text-xs">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
