import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, CreditCard } from "lucide-react";
import { PlanDialog } from "@/components/PlanDialog";

interface PlanExpiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  daysUntilExpiration?: number; // If provided, shows warning instead of expired
}

export const PlanExpiredDialog = ({ 
  open, 
  onOpenChange, 
  planName,
  daysUntilExpiration 
}: PlanExpiredDialogProps) => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  const handleRenew = () => {
    onOpenChange(false);
    setPlanDialogOpen(true);
  };

  const isExpired = daysUntilExpiration === undefined || daysUntilExpiration <= 0;
  const isWarning = !isExpired && daysUntilExpiration !== undefined && daysUntilExpiration <= 7;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              {isExpired ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Clock className="h-6 w-6 text-yellow-500" />
              )}
              <DialogTitle>
                {isExpired ? "Plano Expirado" : "Plano Expirando em Breve"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2">
              {isExpired ? (
                <>
                  Seu plano <strong>{planName}</strong> expirou. Para continuar utilizando seus agentes de IA e todas as funcionalidades da plataforma, renove seu plano agora.
                </>
              ) : (
                <>
                  Seu plano <strong>{planName}</strong> expira em <strong>{daysUntilExpiration} {daysUntilExpiration === 1 ? 'dia' : 'dias'}</strong>. Renove agora para evitar interrupções no serviço.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg my-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              {isExpired 
                ? "Seus agentes estão desativados até a renovação do plano."
                : "Renove para garantir acesso contínuo aos seus agentes."
              }
            </div>
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            {!isExpired && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Lembrar depois
              </Button>
            )}
            <Button onClick={handleRenew} className="w-full sm:w-auto">
              {isExpired ? "Renovar Plano" : "Renovar Agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PlanDialog 
        open={planDialogOpen} 
        onOpenChange={setPlanDialogOpen} 
        profile={{ plano: planName, created_at: new Date().toISOString() }}
      />
    </>
  );
};
