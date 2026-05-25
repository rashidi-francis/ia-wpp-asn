import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import {
  MessageSquare,
  Calendar,
  Bot,
  Zap,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import logo from "@/assets/chatasn-logo.png";
import { HeroPhoneChat } from "@/components/HeroPhoneChat";

const Index = () => {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      } else {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [navigate]);

  // Enquanto verifica sessão de usuário logado, não pisca a landing
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logo} alt="ChatASN" className="w-20 h-20 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ChatASN — Atendimento automático no WhatsApp com IA e agenda Google</title>
        <meta
          name="description"
          content="ChatASN é uma plataforma de atendimento automatizado no WhatsApp com agentes de IA. Conecta-se ao Google Calendar para criar, consultar e gerenciar agendamentos automaticamente nas conversas com seus clientes."
        />
        <link rel="canonical" href="https://ia-wpp-asn.lovable.app/" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
        {/* Header */}
        <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ChatASN" className="w-10 h-10" />
              <span className="font-bold text-lg">ChatASN</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Entrar
              </Button>
              <Button onClick={() => navigate("/login")}>
                Começar grátis
              </Button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.25),transparent_55%)]" />
            <div
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.5) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage:
                  "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 40%, transparent 75%)",
              }}
            />
            <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/30 blur-3xl animate-float" />
            <div
              className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent/30 blur-3xl animate-float"
              style={{ animationDelay: "1.5s" }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl animate-glow-pulse" />
          </div>

          <div className="container mx-auto px-4 pt-8 pb-16 md:pt-12 md:pb-24 relative">
            <div className="grid lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr] gap-8 lg:gap-10 items-center">
              {/* Left: copy */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-md text-sm animate-fade-in">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span className="text-foreground/80">
                    IA online • respondendo agora no WhatsApp
                  </span>
                </div>

                <h1
                  className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-bold mb-6 leading-[1.05] tracking-tight bg-[linear-gradient(110deg,hsl(var(--primary)),hsl(var(--accent)),hsl(var(--primary)))] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-shift"
                  style={{ animationDuration: "6s" }}
                >
                  O futuro do<br />atendimento
                  <span className="block mt-2 text-foreground/90 text-2xl md:text-3xl lg:text-3xl xl:text-4xl font-light">
                    já está no seu WhatsApp
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-8 animate-slide-up">
                  Agentes de IA que conversam, qualificam leads e{" "}
                  <span className="text-foreground font-medium">
                    agendam no Google Calendar
                  </span>{" "}
                  — 24h por dia, sem você levantar um dedo.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center animate-fade-in-scale">
                  <Button
                    size="lg"
                    onClick={() => navigate("/login")}
                    className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_40px_hsl(var(--primary)/0.6)] transition-all duration-300 h-14 px-8 text-base"
                  >
                    <span className="relative z-10 flex items-center">
                      Criar minha conta grátis
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="h-14 px-8 text-base border-primary/30 bg-background/40 backdrop-blur-md hover:bg-primary/10 hover:border-primary/60"
                  >
                    <a href="#como-funciona">Ver como funciona</a>
                  </Button>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    <span>Dados isolados por empresa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <span>Resposta em segundos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Google Calendar</span>
                  </div>
                </div>
              </div>

              {/* Right: live infinite chat mockup */}
              <div className="relative flex justify-center lg:justify-end animate-fade-in-scale">
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 via-accent/30 to-transparent blur-3xl rounded-full" />

                {/* Floating AI badge */}
                <div className="absolute -top-2 -left-2 lg:left-0 z-20 bg-card/80 backdrop-blur-md border border-primary/40 rounded-2xl px-3 py-2 shadow-[0_0_30px_hsl(var(--primary)/0.5)] animate-float flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">IA respondendo</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>

                {/* Floating calendar badge */}
                <div className="absolute -bottom-2 -right-2 lg:right-0 z-20 bg-card/80 backdrop-blur-md border border-success/40 rounded-2xl px-3 py-2 shadow-[0_0_30px_hsl(var(--success)/0.4)] animate-float flex items-center gap-2" style={{ animationDelay: "1.5s" }}>
                  <Calendar className="h-4 w-4 text-success" />
                  <div className="text-left">
                    <p className="text-xs font-medium leading-tight">Agendado!</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Amanhã, 14:30</p>
                  </div>
                </div>

                <HeroPhoneChat />
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* Finalidade do app — exigência Google */}
        <section id="finalidade" className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Para que serve o ChatASN
            </h2>
            <p className="text-muted-foreground mb-4">
              O ChatASN é uma plataforma SaaS que permite a pequenas e médias
              empresas automatizarem o atendimento de clientes no WhatsApp
              através de agentes de Inteligência Artificial personalizados.
              Cada empresa configura seu próprio agente com instruções, tom de
              voz e regras de negócio, e o agente passa a responder
              automaticamente as mensagens recebidas no WhatsApp.
            </p>
            <p className="text-muted-foreground">
              Quando o cliente deseja marcar um horário (consulta, reunião,
              orçamento, atendimento), o agente de IA consulta a disponibilidade
              da empresa diretamente no <strong>Google Calendar</strong>,
              oferece horários livres e <strong>cria o evento</strong> na
              agenda automaticamente, enviando a confirmação ao cliente pelo
              WhatsApp.
            </p>
          </div>
        </section>

        {/* Funcionalidades */}
        <section id="como-funciona" className="container mx-auto px-4 py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Como o ChatASN funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6">
              <MessageSquare className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Conecta seu WhatsApp
              </h3>
              <p className="text-sm text-muted-foreground">
                Vincule o número de WhatsApp da sua empresa em poucos cliques.
                O agente passa a receber e responder mensagens dos clientes
                automaticamente.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <Bot className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                IA treinada para seu negócio
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure as instruções, produtos, serviços e horários da sua
                empresa. A IA responde no tom da sua marca e segue suas regras.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <Calendar className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Agenda no Google Calendar
              </h3>
              <p className="text-sm text-muted-foreground">
                Ao conectar sua conta Google, o agente consulta horários livres
                e cria eventos automaticamente na sua agenda quando o cliente
                marca um compromisso pelo WhatsApp.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <Clock className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Atendimento 24/7
              </h3>
              <p className="text-sm text-muted-foreground">
                Seus clientes recebem resposta imediata a qualquer hora do dia
                ou da noite, mesmo fora do horário comercial.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <Zap className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Follow-up automático
              </h3>
              <p className="text-sm text-muted-foreground">
                A plataforma envia mensagens de retomada para leads que não
                responderam, aumentando sua taxa de conversão.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <ShieldCheck className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Seguro e privado
              </h3>
              <p className="text-sm text-muted-foreground">
                Cada empresa tem seus próprios dados isolados. Os tokens do
                Google Calendar ficam armazenados de forma segura e são usados
                apenas para a agenda da sua empresa.
              </p>
            </div>
          </div>
        </section>

        {/* Uso do Google Calendar — transparência exigida pelo Google */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-10">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="h-8 w-8 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold">
                Como usamos o Google Calendar
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Quando você conecta sua conta Google ao ChatASN, solicitamos
              acesso aos seguintes escopos, exclusivamente para viabilizar o
              agendamento automático nas conversas do WhatsApp:
            </p>
            <ul className="space-y-3 text-muted-foreground mb-4">
              <li>
                <strong>https://www.googleapis.com/auth/calendar.events</strong> —
                para criar, ler e atualizar eventos na sua agenda quando um
                cliente marca um compromisso pelo WhatsApp.
              </li>
              <li>
                <strong>https://www.googleapis.com/auth/userinfo.email</strong> —
                para identificar qual conta Google está conectada e exibir essa
                informação no painel da empresa.
              </li>
            </ul>
            <p className="text-muted-foreground">
              Não lemos eventos não relacionados aos agendamentos do agente,
              não compartilhamos os dados da sua agenda com terceiros e não
              utilizamos os dados para treinar modelos de IA. Você pode
              desconectar sua conta Google a qualquer momento no painel.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comece agora gratuitamente
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Crie sua conta e configure seu primeiro agente de IA em minutos.
            Sem cartão de crédito.
          </p>
          <Button size="lg" onClick={() => navigate("/login")}>
            Criar minha conta grátis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 mt-16">
          <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
            <p>© 2024 ChatASN — Ajudo Seu Negócio IA</p>
            <p className="mt-2">
              Plataforma de atendimento automatizado no WhatsApp com IA e
              integração com Google Calendar.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
