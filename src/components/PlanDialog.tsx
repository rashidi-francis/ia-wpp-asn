import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    plano: string;
    created_at: string;
  } | null;
}

const getPlanColor = (plano: string) => {
  switch (plano) {
    case "Básico":
      return "bg-secondary";
    case "Avançado":
      return "bg-accent";
    case "Empresarial":
      return "bg-primary";
    default:
      return "bg-muted";
  }
};

const getPlanFeatures = (plano: string) => {
  switch (plano) {
    case "Básico":
      return [
        "1 agente ativo",
        "Suporte básico",
        "Recursos limitados",
      ];
    case "Avançado":
      return [
        "Até 5 agentes ativos",
        "Suporte prioritário",
        "Recursos avançados",
        "Integrações personalizadas",
      ];
    case "Empresarial":
      return [
        "Agentes ilimitados",
        "Suporte 24/7",
        "Todos os recursos",
        "API dedicada",
        "Consultoria especializada",
      ];
    default:
      return [];
  }
};

export const PlanDialog = ({ open, onOpenChange, profile }: PlanDialogProps) => {
  const handleUpgrade = () => {
    const whatsappNumber = "5511930500397";
    const message = encodeURIComponent("Olá, vim da vossa plataforma de IA, gostaria fazer upgrade do meu plano atual");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meu Plano</DialogTitle>
          <DialogDescription>
            Informações sobre seu plano atual
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Plano Atual</p>
              <Badge className={`${getPlanColor(profile?.plano || "Básico")} text-lg px-4 py-2`}>
                {profile?.plano || "Básico"}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Recursos Inclusos</p>
              <ul className="space-y-2">
                {getPlanFeatures(profile?.plano || "Básico").map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-primary">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Membro desde</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("pt-BR")
                  : "-"}
              </p>
            </div>
          </div>

          {profile?.plano !== "Empresarial" && (
            <Button onClick={handleUpgrade} className="w-full" size="lg">
              <ExternalLink className="mr-2 h-4 w-4" />
              Fazer Upgrade
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
