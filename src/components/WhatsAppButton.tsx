import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import whatsappAvatar from "@/assets/whatsapp-avatar.jpg";

interface WhatsAppButtonProps {
  message?: string;
}

const WhatsAppButton = ({ message }: WhatsAppButtonProps = {}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const whatsappNumber = "5511930500397";
  const encodedMessage = message ? encodeURIComponent(message) : "";
  const whatsappUrl = `https://wa.me/${whatsappNumber}${encodedMessage ? `?text=${encodedMessage}` : ""}`;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {showTooltip && (
        <div className="absolute bottom-20 right-0 bg-card border shadow-lg rounded-lg p-3 w-64 animate-in slide-in-from-bottom-2">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium mb-1">Falar com o time no WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            Tire suas dúvidas e receba suporte personalizado
          </p>
        </div>
      )}

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center justify-center group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="relative">
          {/* Avatar com borda */}
          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-background shadow-lg ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
            <img
              src={whatsappAvatar}
              alt="Suporte WhatsApp"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Ícone do WhatsApp */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>

          {/* Badge de notificação */}
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-pulse">
            1
          </div>
        </div>

        {/* Efeito de pulso */}
        <div className="absolute inset-0 rounded-full bg-[#25D366] opacity-20 animate-ping" />
      </a>
    </div>
  );
};

export default WhatsAppButton;