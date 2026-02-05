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
import { MessageSquareHeart, Check } from "lucide-react";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function FollowUpDialog({ open, onOpenChange, agentId }: FollowUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Follow-up Ativo
          </DialogTitle>
          <DialogDescription>
            Seu agente está configurado para manter o contexto das conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Toggle always on */}
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Follow-up Ativado</p>
                <p className="text-sm text-green-600 dark:text-green-400">Funcionando por padrão</p>
              </div>
            </div>
            <Switch checked={true} disabled className="data-[state=checked]:bg-green-500" />
          </div>

          {/* Explanation text */}
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Seu agente já está configurado por padrão para realizar <strong className="text-foreground">follow-up</strong> na conversa com o seu lead, garantindo que não comece do zero toda a conversação, mas comece do ponto onde parou.
            </p>
            <p>
              Ou seja: ela consegue <strong className="text-foreground">continuar a conversa</strong> com base no interesse do cliente, mantendo todo o contexto anterior.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-700 dark:text-blue-300">
                ⏰ <strong>Reengajamento Automático:</strong> Quando o cliente ficar <strong>12 horas sem responder</strong> após a primeira interação, 
                a IA enviará automaticamente uma mensagem de acompanhamento. As mensagens são enviadas apenas em <strong>horário comercial (8h às 18h)</strong>, 
                para não incomodar o cliente em horários inapropriados.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
