import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExternalLink, Check } from "lucide-react";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    plano: string;
    created_at: string;
  } | null;
}

const plans = [
  {
    name: "Básico",
    monthlyPrice: "R$ 472",
    annualPrice: "R$ 352",
    description: "Perfeito para pequenos negócios começarem com IA conversacional.",
    features: [
      "2 Agentes Inteligentes",
      "Interações Ilimitadas no WhatsApp",
      "Acesso a recursos essenciais do ASN Agentes",
      "Limite de upload por arquivo de 10MB",
      "6 vagas no time",
      "Integração com WhatsApp via QR Code",
    ],
    color: "bg-secondary",
  },
  {
    name: "Avançado",
    monthlyPrice: "R$ 1.552",
    annualPrice: "R$ 1.152",
    description: "Para empresas em crescimento que desejam escalar seu atendimento.",
    features: [
      "6 Agentes Inteligentes",
      "Iterações Ilimitadas no WhatsApp",
      "Acesso a todos os recursos do ASN Agentes",
      "Limite de upload por arquivo de 10MB",
      "20 vagas no time",
      "Integração com WhatsApp via QR Code",
      "Suporte prioritário",
    ],
    color: "bg-accent",
  },
  {
    name: "Empresarial",
    monthlyPrice: "R$ 4.752",
    annualPrice: "R$ 3.552",
    description: "Para empresas que buscam automatizar e aprimorar significativamente suas operações.",
    features: [
      "30 Agentes Inteligentes",
      "Interações Ilimitadas no WhatsApp",
      "Acesso a todos os recursos do ASN Agentes",
      "Limite de upload por arquivo de 20MB",
      "60 vagas no time",
      "Integração com WhatsApp via QR Code",
      "Suporte prioritário",
      "Treinamento e onboarding personalizados",
    ],
    color: "bg-primary",
  },
];

export const PlanDialog = ({ open, onOpenChange, profile }: PlanDialogProps) => {
  const currentPlan = profile?.plano || "Básico";

  const handleUpgrade = (targetPlan: string) => {
    const whatsappNumber = "5511930500397";
    const message = encodeURIComponent(
      `Olá, vim da vossa plataforma de IA, gostaria fazer upgrade do meu plano atual - ${currentPlan.toLowerCase()}, para o plano ${targetPlan.toLowerCase()}.`
    );
    window.open(`https://api.whatsapp.com/send/?phone=${whatsappNumber}&text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planos Disponíveis</DialogTitle>
          <DialogDescription>
            Seu plano atual: <span className="font-semibold">{currentPlan}</span> | Membro desde{" "}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("pt-BR")
              : "-"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 space-y-4 ${
                currentPlan === plan.name ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="space-y-2">
                <Badge className={`${plan.color} text-base px-3 py-1`}>
                  {plan.name}
                  {currentPlan === plan.name && " (Atual)"}
                </Badge>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{plan.monthlyPrice}</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                  <p className="text-sm text-muted-foreground">
                    Anual: {plan.annualPrice}/ano
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {currentPlan !== plan.name && (
                <Button
                  onClick={() => handleUpgrade(plan.name)}
                  className="w-full"
                  variant={currentPlan === "Básico" && plan.name === "Avançado" ? "default" : "outline"}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Upgrade para {plan.name}
                </Button>
              )}

              {currentPlan === plan.name && (
                <Button className="w-full" variant="secondary" disabled>
                  Plano Atual
                </Button>
              )}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
