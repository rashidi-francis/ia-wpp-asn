import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";

interface TrialExpiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrialExpiredDialog = ({ open, onOpenChange }: TrialExpiredDialogProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <DialogTitle>Teste Gratuito Expirado</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            Seu Teste Gratuito de 3 dias na plataforma terminou. Contate o suporte para fazer o upgrade e continuar com seu agente de IA.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            Fazer Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
