import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageSquareHeart, Clock, Info } from "lucide-react";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

const SEQUENCE = [
  {
    order: "1ª",
    delay: "10 minutos",
    text: "Vi que você iniciou conversa mas parou de interagir, há algo que eu possa ajudar?",
  },
  {
    order: "2ª",
    delay: "4 horas",
    text: "Olá, você está por aí? Só me dar um sinal que vamos seguir conversa e te ajudar no que vc precisa tá",
  },
  {
    order: "3ª",
    delay: "12 horas",
    text: "Como até momento não tive seu feedback, vou esperar você retornar tá, talvez não seja seu momento de decisão ou esteja cuidando de outras tarefas por aí, até breve... Ficamos no seu aguardo",
    last: true,
  },
];

export function FollowUpDialog({ open, onOpenChange }: FollowUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Follow-up Automático
          </DialogTitle>
          <DialogDescription>
            Sequência fixa para reengajar leads que pararam de responder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Toggle locked ON */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div>
              <p className="font-medium">Follow-up Automático</p>
              <p className="text-sm text-muted-foreground">
                Reengaje leads que pararam de responder
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked
                disabled
                className="data-[state=checked]:bg-green-500 opacity-100"
              />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Sempre ativo
              </span>
            </div>
          </div>

          {/* Timing summary */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Tempo de espera entre cada mensagem</p>
            <div className="grid grid-cols-3 gap-2">
              {SEQUENCE.map((s, i) => (
                <div
                  key={s.order}
                  className="rounded-lg border bg-card p-3 text-center"
                >
                  <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-sm font-semibold">{s.delay}</p>
                  <p className="text-xs text-muted-foreground">{s.order} msg</p>
                </div>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Os 3 disparos seguem essa ordem fixa
            </p>
          </div>

          {/* Fixed messages (read-only) */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Mensagens enviadas (não editáveis)</p>
            {SEQUENCE.map((s) => (
              <div
                key={s.order}
                className="rounded-lg border bg-muted/40 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">
                    {s.order} (após {s.delay})
                  </span>
                  {s.last && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      última
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {s.text}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ⚠ Limite de 3 mensagens para proteger o número do agente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
