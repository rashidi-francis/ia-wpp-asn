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
import { ExternalLink, Check, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
    monthlyPrice: "R$ 97",
    annualPrice: "R$ 85",
    description: "Perfeito para pequenos negócios começarem com IA conversacional.",
    features: [
      "1 Agente Inteligente",
      "Interações Ilimitadas no WhatsApp",
      "Acesso a recursos essenciais da plataforma ChatASN",
      "Limite de upload por arquivo de 10MB",
      "3 vagas no time",
      "Integração com WhatsApp via QR Code",
    ],
    gradient: "bg-gradient-silver",
  },
  {
    name: "Avançado",
    monthlyPrice: "R$ 320",
    annualPrice: "R$ 269",
    description: "Para empresas em crescimento que desejam escalar seu atendimento.",
    features: [
      "3 Agentes Inteligentes",
      "Interações ilimitadas no WhatsApp",
      "Acesso a todos os recursos da plataforma ChatASN",
      "Limite de upload por arquivo de 10MB",
      "6 vagas no time",
      "Integração com WhatsApp via QR Code",
      "Suporte prioritário",
    ],
    gradient: "bg-gradient-gold",
  },
  {
    name: "Empresarial",
    monthlyPrice: "R$ 650",
    annualPrice: "R$ 530",
    description: "Para empresas que buscam automatizar e aprimorar significativamente suas operações.",
    features: [
      "6 Agentes Inteligentes",
      "Interações Ilimitadas no WhatsApp",
      "Acesso a todos os recursos do ASN Agentes",
      "Limite de upload por arquivo de 20MB",
      "12 vagas no time",
      "Integração com WhatsApp via QR Code",
      "Suporte prioritário",
      "Treinamento e onboarding personalizados",
    ],
    gradient: "bg-gradient-sapphire",
  },
];

export const PlanDialog = ({ open, onOpenChange, profile }: PlanDialogProps) => {
  const currentPlan = profile?.plano || "Básico";
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  
  const planOrder = { "Plano Teste Grátis": 0, "Básico": 1, "Avançado": 2, "Empresarial": 3 };
  
  const getPlanAction = (targetPlan: string) => {
    const currentOrder = planOrder[currentPlan as keyof typeof planOrder] || 1;
    const targetOrder = planOrder[targetPlan as keyof typeof planOrder] || 1;
    return targetOrder > currentOrder ? "upgrade" : "downgrade";
  };

  const handlePlanChange = async (targetPlan: string) => {
    // For free trial, redirect to WhatsApp (can't pay for free)
    if (targetPlan === "Plano Teste Grátis") {
      const whatsappNumber = "5511930500397";
      const action = getPlanAction(targetPlan);
      const message = encodeURIComponent(
        `Olá, vim da vossa plataforma de IA, gostaria fazer ${action} do meu plano atual - ${currentPlan.toLowerCase()}, para o plano ${targetPlan.toLowerCase()}.`
      );
      window.open(`https://api.whatsapp.com/send/?phone=${whatsappNumber}&text=${message}`, "_blank");
      return;
    }

    // For paid plans, create checkout
    setLoadingPlan(targetPlan);
    
    try {
      const { data, error } = await supabase.functions.invoke('pagarme-checkout', {
        body: {
          planName: targetPlan,
          billingType: isAnnual ? 'annual' : 'monthly',
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`,
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        toast({
          variant: "destructive",
          title: "Erro ao processar",
          description: "Não foi possível criar o checkout. Tente novamente.",
        });
        return;
      }

      if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        toast({
          title: "Checkout aberto",
          description: "Complete o pagamento na nova aba para ativar seu plano.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "URL de pagamento não disponível.",
        });
      }
    } catch (err) {
      console.error('Error:', err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    } finally {
      setLoadingPlan(null);
    }
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
                  disabled={loadingPlan === plan.name}
                >
                  {loadingPlan === plan.name ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {getPlanAction(plan.name) === "upgrade" ? "Upgrade" : "Downgrade"} para {plan.name}
                    </>
                  )}
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

        {/* Agency Boss Plan */}
        <Card className="relative overflow-hidden border-2 border-primary/50 bg-gradient-to-r from-primary/5 to-accent/5 p-6 mt-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Agency Boss</h3>
                <p className="text-xl font-bold text-primary mb-3">Preço personalizado</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Pensado para empresas de grande porte que precisam de soluções avançadas e personalizadas em IA conversacional.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="font-semibold text-sm">Inclui todos os recursos dos planos anteriores, além de:</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Quantidade de funcionalidades ajustada conforme a demanda</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Suporte especializado 24 horas por dia, 7 dias por semana</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Treinamentos exclusivos e onboarding sob medida</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Acompanhamento de um gerente de conta sênior</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>APIs para conectar a IA aos seus sistemas internos</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Integração e sincronização de bases de dados</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Suporte a uploads de arquivos de até 50MB</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Entre outros benefícios adicionais</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-4">
                Quer algo ainda mais completo? Fale com nossa equipe e criaremos a solução ideal para você.
              </p>
            </div>
            
            <Button 
              className="w-full md:w-auto" 
              size="lg"
              onClick={() => {
                const message = encodeURIComponent("Olá, vim da vossa plataforma de IA e gostaria de saber mais sobre o plano personalizado Agency Boss");
                window.open(`https://wa.me/5511930500397?text=${message}`, '_blank');
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Fale com nossa equipe
            </Button>
          </div>
        </Card>

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
                  // Prevent downgrade from paid plans to free trial
                  (planOrder[currentPlan as keyof typeof planOrder] >= 1 && plan.name === "Plano Teste Grátis") ? (
                    <Button className="w-full" variant="outline" disabled>
                      Não disponível
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePlanChange(plan.name)}
                      className="w-full"
                      variant={getPlanAction(plan.name) === "upgrade" ? "default" : "outline"}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {getPlanAction(plan.name) === "upgrade" ? "Upgrade" : "Downgrade"} para {plan.name}
                    </Button>
                  )
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