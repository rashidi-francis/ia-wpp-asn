import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Mic,
  Play,
  FileText,
  Image as ImageIcon,
  Check,
} from "lucide-react";

type MsgKind =
  | "text-in"
  | "text-out"
  | "audio-in"
  | "image-in"
  | "pdf-in"
  | "typing";

interface Msg {
  id: number;
  kind: MsgKind;
  content?: string;
  time?: string;
  caption?: string;
}

// Roteiro longo simulando uma jornada real de atendimento.
// Mistura texto, áudio, imagem e PDF do lado do cliente,
// e a IA respondendo de forma natural — qualificando,
// tirando dúvidas e agendando no Google Calendar.
const SCRIPT: Omit<Msg, "id">[] = [
  { kind: "text-in", content: "Oi! Vi o site de vocês, ainda atendem hoje?", time: "10:41" },
  { kind: "typing" },
  { kind: "text-out", content: "Olá! 👋 Atendemos sim, até as 19h. Posso te ajudar?", time: "10:41" },
  { kind: "text-in", content: "Quero saber sobre o serviço completo", time: "10:42" },
  { kind: "audio-in", caption: "Áudio • 0:14", time: "10:42" },
  { kind: "typing" },
  { kind: "text-out", content: "Recebi seu áudio 🎧 Você quer o pacote mensal, certo? Posso te enviar valores.", time: "10:43" },
  { kind: "text-in", content: "Isso! E vocês têm portfólio?", time: "10:43" },
  { kind: "typing" },
  { kind: "text-out", content: "Claro! Te envio agora 👇", time: "10:43" },
  { kind: "image-in", caption: "portfolio.jpg", time: "10:44" },
  { kind: "pdf-in", caption: "Tabela_Precos_2026.pdf • 280 KB", time: "10:44" },
  { kind: "text-in", content: "Perfeito! Dá pra agendar uma reunião amanhã?", time: "10:45" },
  { kind: "typing" },
  { kind: "text-out", content: "Sim! Tenho 14:30 ou 16:00 livres. Qual prefere?", time: "10:45" },
  { kind: "text-in", content: "14:30 tá ótimo", time: "10:46" },
  { kind: "typing" },
  { kind: "text-out", content: "Fechado ✅ Agendei amanhã 14:30 no Google Calendar. Te envio lembrete 1h antes 🔔", time: "10:46" },
  { kind: "image-in", caption: "comprovante.png", time: "10:47" },
  { kind: "typing" },
  { kind: "text-out", content: "Comprovante recebido 📎 Já anexei ao seu atendimento. Algo mais?", time: "10:47" },
  { kind: "audio-in", caption: "Áudio • 0:09", time: "10:48" },
  { kind: "typing" },
  { kind: "text-out", content: "Entendi! Vou pedir pro responsável te ligar antes da reunião. Combinado? 😉", time: "10:49" },
  { kind: "text-in", content: "Combinado, valeu!", time: "10:49" },
  { kind: "typing" },
  { kind: "text-out", content: "Eu que agradeço 🙏 Até amanhã às 14:30!", time: "10:50" },
];

const Bubble = ({ msg }: { msg: Msg }) => {
  const isOut = msg.kind === "text-out";
  const base =
    "max-w-[82%] text-[11px] rounded-lg px-2.5 py-1.5 shadow animate-fade-in";
  const inStyle = "bg-[#202c33] text-white rounded-tl-none";
  const outStyle = "bg-[#005c4b] text-white rounded-tr-none";

  if (msg.kind === "typing") {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-2.5 py-2 flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
          <span
            className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    );
  }

  const wrapper = isOut ? "flex justify-end" : "flex justify-start";
  const bubble = `${base} ${isOut ? outStyle : inStyle}`;

  return (
    <div className={wrapper}>
      <div className={bubble}>
        {msg.kind === "audio-in" && (
          <div className="flex items-center gap-2 py-0.5 min-w-[140px]">
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <Play className="h-3 w-3 text-white" fill="currentColor" />
            </div>
            <div className="flex-1 flex items-center gap-0.5">
              {[3, 5, 8, 4, 6, 9, 4, 7, 5, 3, 6, 8, 4, 5].map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-white/60"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <Mic className="h-3 w-3 text-white/70" />
          </div>
        )}

        {msg.kind === "image-in" && (
          <div className="space-y-1">
            <div className="w-44 h-24 rounded-md bg-gradient-to-br from-primary/50 via-accent/40 to-primary/30 flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-white/80" />
            </div>
            <p className="text-[10px] text-white/70">{msg.caption}</p>
          </div>
        )}

        {msg.kind === "pdf-in" && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <div className="w-8 h-9 rounded-md bg-white/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-white/90" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] truncate">{msg.caption}</p>
              <p className="text-[9px] text-white/60">PDF</p>
            </div>
          </div>
        )}

        {(msg.kind === "text-in" || msg.kind === "text-out") && (
          <span>{msg.content}</span>
        )}

        {msg.time && (
          <span className="block text-[8px] text-white/50 text-right mt-0.5">
            {msg.time}
            {isOut && <span className="ml-0.5">✓✓</span>}
          </span>
        )}
      </div>
    </div>
  );
};

export const HeroPhoneChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cursor, setCursor] = useState(0);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Adiciona uma nova mensagem a cada intervalo, em loop infinito.
  useEffect(() => {
    const next = SCRIPT[cursor % SCRIPT.length];
    const delay = next.kind === "typing" ? 900 : 1700;

    const t = setTimeout(() => {
      idRef.current += 1;
      const newMsg: Msg = { ...next, id: idRef.current };

      setMessages((prev) => {
        // remove "typing" anterior se a próxima for a resposta de fato
        const cleaned =
          next.kind !== "typing" && prev[prev.length - 1]?.kind === "typing"
            ? prev.slice(0, -1)
            : prev;
        const updated = [...cleaned, newMsg];
        // mantém histórico limitado para não estourar memória
        return updated.length > 40 ? updated.slice(-40) : updated;
      });
      setCursor((c) => c + 1);
    }, delay);

    return () => clearTimeout(t);
  }, [cursor]);

  // Auto-scroll suave para o final
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative w-[260px] sm:w-[280px] md:w-[300px] aspect-[9/19] rounded-[2.5rem] bg-gradient-to-b from-slate-800 to-slate-950 p-2.5 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.6)] border border-white/10">
      <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-[#0b141a] flex flex-col">
        {/* Notch */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />

        {/* WhatsApp header */}
        <div className="bg-[#202c33] px-3 pt-7 pb-2 flex items-center gap-2 border-b border-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white">
            IA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              Serviço Automatico
            </p>
            <p className="text-[9px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              online
            </p>
          </div>
          <Check className="h-3.5 w-3.5 text-white/40" />
        </div>

        {/* Chat area scrollável */}
        <div
          ref={scrollRef}
          className="flex-1 px-3 py-3 space-y-2 overflow-hidden scroll-smooth"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.08), transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--accent)/0.08), transparent 50%)",
            backgroundColor: "#0b141a",
          }}
        >
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
        </div>

        {/* Input bar */}
        <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2">
          <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 text-[10px] text-white/40">
            Mensagem
          </div>
          <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};
