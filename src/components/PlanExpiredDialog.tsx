import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, CreditCard, Zap } from "lucide-react";
import { PlanDialog } from "@/components/PlanDialog";
import { supabase } from "@/integrations/supabase/client";

interface PlanExpiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  daysUntilExpiration?: number;
  agentId?: string;
}

export const PlanExpiredDialog = ({ 
  open, 
  onOpenChange, 
  planName,
  daysUntilExpiration,
  agentId
}: PlanExpiredDialogProps) => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  const isExpired = daysUntilExpiration === undefined || daysUntilExpiration <= 0;
  const isWarning = !isExpired && daysUntilExpiration !== undefined && daysUntilExpiration <= 7;

  // Disconnect WhatsApp when plan expires
  useEffect(() => {
    if (open && isExpired && agentId) {
      disconnectWhatsApp(agentId);
    }
  }, [open, isExpired, agentId]);

  const disconnectWhatsApp = async (agentId: string) => {
    try {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('agent_id', agentId)
        .eq('status', 'connected')
        .maybeSingle();

      if (instance) {
        console.log('Disconnecting WhatsApp due to expired plan:', instance.instance_name);
        await supabase.functions.invoke('evolution-api', {
          body: { action: 'disconnect', agentId }
        });
      }
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
    }
  };

  const handleRenew = () => {
    onOpenChange(false);
    setPlanDialogOpen(true);
  };

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
                ? "Seus agentes estão desativados e o WhatsApp foi desconectado até a renovação do plano."
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
              <Zap className="mr-2 h-4 w-4" />
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