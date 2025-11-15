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
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Check } from "lucide-react";
import { useState } from "react";

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
    name: "Plano Teste Grátis",
    monthlyPrice: "GRÁTIS",
    annualPrice: "GRÁTIS",
    description: "Experimente nossa plataforma gratuitamente por 3 dias.",
    features: [
      "1 Agente Inteligente",
      "Teste por 3 dias",
      "Acesso a recursos essenciais do ASN Agentes",
      "Interações Ilimitadas no WhatsApp",
      "Integração com WhatsApp via QR Code",
    ],
    gradient: "bg-gradient-bronze",
    isTrial: true,
  },
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
    gradient: "bg-gradient-silver",
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
    gradient: "bg-gradient-gold",
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
    gradient: "bg-gradient-platinum",
  },
];

export const PlanDialog = ({ open, onOpenChange, profile }: PlanDialogProps) => {
  const currentPlan = profile?.plano || "Básico";
  const [isAnnual, setIsAnnual] = useState(true);
  
  const planOrder = { "Plano Teste Grátis": 0, "Básico": 1, "Avançado": 2, "Empresarial": 3 };
  
  const getPlanAction = (targetPlan: string) => {
    const currentOrder = planOrder[currentPlan as keyof typeof planOrder] || 1;
    const targetOrder = planOrder[targetPlan as keyof typeof planOrder] || 1;
    return targetOrder > currentOrder ? "upgrade" : "downgrade";
  };

  const handlePlanChange = (targetPlan: string) => {
    const whatsappNumber = "5511930500397";
    const action = getPlanAction(targetPlan);
    const message = encodeURIComponent(
      `Olá, vim da vossa plataforma de IA, gostaria fazer ${action} do meu plano atual - ${currentPlan.toLowerCase()}, para o plano ${targetPlan.toLowerCase()}.`
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
        
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensal
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual
          </span>
          <Badge className="bg-primary text-primary-foreground">
            25% OFF
          </Badge>
        </div>
        
        {/* Planos Pagos em Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {plans.filter(plan => !plan.isTrial).map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 space-y-4 ${
                currentPlan === plan.name ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="space-y-2">
                <Badge className={`${plan.gradient} text-white text-base px-3 py-1`}>
                  {plan.name}
                  {currentPlan === plan.name && " (Atual)"}
                </Badge>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {plan.isTrial ? plan.monthlyPrice : (isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                  </p>
                  {!plan.isTrial && (
                    <p className="text-sm text-muted-foreground">
                      /{isAnnual ? 'mês' : 'mês'}
                    </p>
                  )}
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
                  onClick={() => handlePlanChange(plan.name)}
                  className="w-full"
                  variant={getPlanAction(plan.name) === "upgrade" ? "default" : "outline"}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {getPlanAction(plan.name) === "upgrade" ? "Upgrade" : "Downgrade"} para {plan.name}
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

        {/* Plano Teste Grátis - Horizontal */}
        {plans.filter(plan => plan.isTrial).map((plan) => (
          <Card
            key={plan.name}
            className={`p-6 mt-6 ${
              currentPlan === plan.name ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Info do Plano */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className={`${plan.gradient} text-white text-base px-3 py-1`}>
                    {plan.name}
                    {currentPlan === plan.name && " (Atual)"}
                  </Badge>
                  <p className="text-2xl font-bold">{plan.monthlyPrice}</p>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* Features em linha */}
              <div className="flex-1">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botão de Ação */}
              <div className="md:w-48">
                {currentPlan !== plan.name ? (
                  <Button
                    onClick={() => handlePlanChange(plan.name)}
                    className="w-full"
                    variant={getPlanAction(plan.name) === "upgrade" ? "default" : "outline"}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {getPlanAction(plan.name) === "upgrade" ? "Upgrade" : "Downgrade"} para {plan.name}
                  </Button>
                ) : (
                  <Button className="w-full" variant="secondary" disabled>
                    Plano Atual
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </DialogContent>
    </Dialog>
  );
};
