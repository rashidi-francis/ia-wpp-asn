import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  onSendMessage,
  disabled = false,
  placeholder = "Digite sua mensagem...",
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;

    setSending(true);
    try {
      await onSendMessage(trimmedMessage);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-card p-3"
    >
      <div className="flex items-end gap-2">
        <AutoResizeTextarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="flex-1 min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || sending || disabled}
          className="shrink-0"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Resposta manual (será enviada como atendente humano)
      </p>
    </form>
  );
};
