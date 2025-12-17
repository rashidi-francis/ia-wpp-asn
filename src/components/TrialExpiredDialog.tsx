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
import { AlertCircle, Zap } from "lucide-react";
import { PlanDialog } from "@/components/PlanDialog";
import { supabase } from "@/integrations/supabase/client";

interface TrialExpiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
}

export const TrialExpiredDialog = ({ open, onOpenChange, agentId }: TrialExpiredDialogProps) => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  // Disconnect WhatsApp when trial expires
  useEffect(() => {
    if (open && agentId) {
      disconnectWhatsApp(agentId);
    }
  }, [open, agentId]);

  const disconnectWhatsApp = async (agentId: string) => {
    try {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('agent_id', agentId)
        .eq('status', 'connected')
        .maybeSingle();

      if (instance) {
        console.log('Disconnecting WhatsApp due to expired trial:', instance.instance_name);
        await supabase.functions.invoke('evolution-api', {
          body: { action: 'disconnect', agentId }
        });
      }
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    setPlanDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <DialogTitle>Período de Teste Terminado</DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2 space-y-3">
              <p>
                O seu período de <strong>Teste Gratuito de 3 dias</strong> na plataforma terminou.
              </p>
              <p>
                Para continuar a utilizar o seu agente de IA, faça o upgrade para um plano pago.
              </p>
              <p className="text-destructive/80 text-sm">
                Durante este período, o seu agente está desativado e não responde a mensagens no WhatsApp.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={handleUpgrade} className="w-full sm:w-auto">
              <Zap className="mr-2 h-4 w-4" />
              Fazer Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PlanDialog 
        open={planDialogOpen} 
        onOpenChange={setPlanDialogOpen} 
        profile={{ plano: "Plano Teste Grátis", created_at: new Date().toISOString() }}
      />
    </>
  );
};