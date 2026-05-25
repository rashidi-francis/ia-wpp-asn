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
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Atendimento automático no WhatsApp com IA
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            O ChatASN é uma plataforma para empresas brasileiras criarem agentes
            de Inteligência Artificial que respondem clientes no WhatsApp 24h
            por dia, qualificam leads e <strong>agendam compromissos
            diretamente no Google Calendar</strong> da sua empresa — sem
            intervenção humana.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/login")}>
              Criar minha conta grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#como-funciona">Como funciona</a>
            </Button>
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
            <p>© {new Date().getFullYear()} ChatASN — Ajudo Seu Negócio IA</p>
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
