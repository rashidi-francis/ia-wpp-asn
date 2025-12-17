import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import emailjs from '@emailjs/browser';
import { Footer } from "@/components/Footer";
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog";
import { PlanExpiredDialog } from "@/components/PlanExpiredDialog";
import WhatsAppConnection from "@/components/WhatsAppConnection";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

interface Agent {
  id: string;
  user_id: string;
  nome: string | null;
  quem_eh: string | null;
  o_que_faz: string | null;
  objetivo: string | null;
  como_deve_responder: string | null;
  instrucoes_agente: string | null;
  topicos_evitar: string | null;
  palavras_evitar: string | null;
  links_permitidos: string | null;
  regras_personalizadas: string | null;
  resposta_padrao_erro: string | null;
  resposta_secundaria_erro: string | null;
  created_at: string;
  updated_at: string;
}

const Agent = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [showPlanExpired, setShowPlanExpired] = useState(false);
  const [showPlanWarning, setShowPlanWarning] = useState(false);
  const [currentPlanName, setCurrentPlanName] = useState("");
  const [daysUntilExpiration, setDaysUntilExpiration] = useState<number | undefined>();
  const [nome, setNome] = useState("");
  const [quemEh, setQuemEh] = useState("");
  const [oQueFaz, setOQueFaz] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [comoDeveResponder, setComoDeveResponder] = useState("");
  const [instrucoesAgente, setInstrucoesAgente] = useState("");
  const [topicosEvitar, setTopicosEvitar] = useState("");
  const [palavrasEvitar, setPalavrasEvitar] = useState("");
  const [linksPermitidos, setLinksPermitidos] = useState("");
  const [regrasPersonalizadas, setRegrasPersonalizadas] = useState("");
  const [respostaPadraoErro, setRespostaPadraoErro] = useState("");
  const [respostaSecundariaErro, setRespostaSecundariaErro] = useState("");

  // Auto-save draft data
  const draftData = useMemo(() => ({
    nome,
    quemEh,
    oQueFaz,
    objetivo,
    comoDeveResponder,
    instrucoesAgente,
    topicosEvitar,
    palavrasEvitar,
    linksPermitidos,
    regrasPersonalizadas,
    respostaPadraoErro,
    respostaSecundariaErro,
  }), [nome, quemEh, oQueFaz, objetivo, comoDeveResponder, instrucoesAgente, topicosEvitar, palavrasEvitar, linksPermitidos, regrasPersonalizadas, respostaPadraoErro, respostaSecundariaErro]);

  const draftSetters = useMemo(() => ({
    nome: setNome,
    quemEh: setQuemEh,
    oQueFaz: setOQueFaz,
    objetivo: setObjetivo,
    comoDeveResponder: setComoDeveResponder,
    instrucoesAgente: setInstrucoesAgente,
    topicosEvitar: setTopicosEvitar,
    palavrasEvitar: setPalavrasEvitar,
    linksPermitidos: setLinksPermitidos,
    regrasPersonalizadas: setRegrasPersonalizadas,
    respostaPadraoErro: setRespostaPadraoErro,
    respostaSecundariaErro: setRespostaSecundariaErro,
  }), []);

  const { clearDraft } = useDraftAutosave({
    key: `agent-draft-${id}`,
    data: draftData,
    setters: draftSetters,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user && id) {
      loadAgent();
    }
  }, [session, id]);

  const loadAgent = async () => {
    if (!session?.user || !id) return;

    try {
      // Verificar o plano do usuário e data de criação/expiração
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("plano, created_at, plan_expires_at")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentPlanName(profileData.plano);

      // Verificar se o plano expirou (Plano Teste Grátis + mais de 3 dias)
      if (profileData.plano === "Plano Teste Grátis") {
        const createdAt = new Date(profileData.created_at);
        const now = new Date();
        const diffInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffInDays > 3) {
          setShowTrialExpired(true);
          setLoading(false);
          return;
        }
      } else if (profileData.plan_expires_at) {
        // Verificar expiração de planos pagos
        const expiresAt = new Date(profileData.plan_expires_at);
        const now = new Date();
        const diffInDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        setDaysUntilExpiration(diffInDays);
        
        if (diffInDays <= 0) {
          // Plano expirou
          setShowPlanExpired(true);
          setLoading(false);
          return;
        } else if (diffInDays <= 7) {
          // Aviso de expiração próxima (não bloqueia, apenas avisa)
          setShowPlanWarning(true);
        }
      }

      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      setAgent(data);

      // Se existir rascunho local com conteúdo, NÃO sobrescreva com valores do banco
      // (isso evita perder texto ao voltar pra aba e o loadAgent rodar novamente)
      let hasDraftContent = false;
      try {
        const savedDraft = localStorage.getItem(`agent-draft-${id}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft) as Record<string, string>;
          hasDraftContent = Object.values(parsed).some(
            (v) => typeof v === "string" && v.trim() !== ""
          );
        }
      } catch {
        // ignore
      }

      if (!hasDraftContent) {
        setNome(data.nome || "");
        setQuemEh(data.quem_eh || "");
        setOQueFaz(data.o_que_faz || "");
        setObjetivo(data.objetivo || "");
        setComoDeveResponder(data.como_deve_responder || "");
        setInstrucoesAgente(data.instrucoes_agente || "");
        setTopicosEvitar(data.topicos_evitar || "");
        setPalavrasEvitar(data.palavras_evitar || "");
        setLinksPermitidos(data.links_permitidos || "");
        setRegrasPersonalizadas(data.regras_personalizadas || "");
        setRespostaPadraoErro(data.resposta_padrao_erro || "");
        setRespostaSecundariaErro(data.resposta_secundaria_erro || "");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar agente",
        description: error.message,
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user || !id) return;

    setSaving(true);
    try {
      // 1️⃣ Salva no Supabase
      const { error } = await supabase
        .from("agents")
        .update({
          nome: nome,
          quem_eh: quemEh,
          o_que_faz: oQueFaz,
          objetivo: objetivo,
          como_deve_responder: comoDeveResponder,
          instrucoes_agente: instrucoesAgente,
          topicos_evitar: topicosEvitar,
          palavras_evitar: palavrasEvitar,
          links_permitidos: linksPermitidos,
          regras_personalizadas: regrasPersonalizadas,
          resposta_padrao_erro: respostaPadraoErro,
          resposta_secundaria_erro: respostaSecundariaErro,
        })
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) throw error;

      // 2️⃣ Sincroniza com n8n/Cloudfy (envia instruções concatenadas)
      const { error: syncError } = await supabase.functions.invoke('sync-agent-n8n', {
        body: { agentId: id }
      });

      if (syncError) {
        console.error("Erro ao sincronizar com n8n:", syncError);
        // Não bloqueia o salvamento, apenas loga o erro
      }

      // 3️⃣ Envia e-mail via EmailJS
      emailjs.init('NmeVuycVzIv4cDkxi');
      
      const templateParams = {
        user_email: session.user.email,
        user_name: session.user.user_metadata?.full_name || session.user.email,
        agent_name: nome,
        agent_identity: quemEh,
        agent_function: oQueFaz,
        agent_goal: objetivo,
        agent_tone: comoDeveResponder,
        agent_instructions: instrucoesAgente,
        agent_forbidden_topics: topicosEvitar,
        agent_forbidden_words: palavrasEvitar,
        agent_allowed_links: linksPermitidos,
        agent_custom_rules: regrasPersonalizadas,
        agent_default_response: respostaPadraoErro,
        agent_secondary_response: respostaSecundariaErro,
        date: new Date().toLocaleString('pt-BR'),
      };

      await emailjs.send(
        'service_mibcy3e',
        'template_kms9cib',
        templateParams
      );

      // Clear draft after successful save
      clearDraft();

      toast({
        title: "Instruções salvas com sucesso",
        description: "Suas alterações foram salvas e sincronizadas.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        variant: "destructive",
        title: "❌ Erro ao salvar ou enviar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 animate-gradient-shift bg-[length:200%_200%]">
      <header className="border-b border-primary/20 bg-card/80 backdrop-blur-xl shadow-lg sticky top-0 z-10 animate-fade-in">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-primary/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-glow-pulse">
              <span className="text-lg font-bold text-primary-foreground">AI</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Instruções do Agente</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="shadow-lg hover:shadow-glow transition-all duration-300">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Instruções
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6 border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-glow animate-fade-in-scale">
          <CardHeader>
            <CardTitle className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Configure seu Agente de IA</CardTitle>
            <CardDescription>
              Preencha as informações abaixo para definir o comportamento do seu agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-base font-semibold">
                1. Qual o nome de seu Agente
              </Label>
              <Input
                id="nome"
                placeholder="Digite o nome do seu agente..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={100}
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quem-eh" className="text-base font-semibold">
                2. Quem é seu agente?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Descreva identidade e principais características, personalidade do Agente, etc.
              </p>
              <Textarea
                id="quem-eh"
                placeholder="Descreva quem é seu agente..."
                value={quemEh}
                onChange={(e) => setQuemEh(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="o-que-faz" className="text-base font-semibold">
                3. O que seu agente faz?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina o papel principal do seu Agente. Como ele deve se comportar, quais são suas responsabilidades, etc.
              </p>
              <Textarea
                id="o-que-faz"
                placeholder="Explique as atividades e funções que seu agente desempenha..."
                value={oQueFaz}
                onChange={(e) => setOQueFaz(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objetivo" className="text-base font-semibold">
                4. Qual é o objetivo de seu agente?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Especifique o objetivo final do seu Agente nesta interação. Isso ajuda o Agente a se concentrar em ações específicas para alcançar esse objetivo.
              </p>
              <Textarea
                id="objetivo"
                placeholder="Defina os objetivos principais e metas do seu agente..."
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="como-deve-responder" className="text-base font-semibold">
                5. Como o seu agente deve responder?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina o tom e o estilo das respostas do seu Agente. Isso ajuda o Agente a entender como se comunicar de forma eficaz.
              </p>
              <Textarea
                id="como-deve-responder"
                placeholder="Defina o tom e estilo de comunicação..."
                value={comoDeveResponder}
                onChange={(e) => setComoDeveResponder(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>REGRAS GERAIS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="instrucoes-agente" className="text-base font-semibold">
                1. Instruções para o agente
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina as principais responsabilidades e ações que o seu Agente deve executar. Isso ajuda o Agente a compreender seu papel e a realizar suas tarefas de forma eficaz.
              </p>
              <Textarea
                id="instrucoes-agente"
                placeholder="Digite as instruções principais..."
                value={instrucoesAgente}
                onChange={(e) => setInstrucoesAgente(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicos-evitar" className="text-base font-semibold">
                2. Quais tópicos seu agente deve evitar?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina os tópicos que o seu Agente deve evitar. Isso ajuda o Agente a entender sobre o que ele não deve falar.
              </p>
              <Textarea
                id="topicos-evitar"
                placeholder="Liste os tópicos que devem ser evitados..."
                value={topicosEvitar}
                onChange={(e) => setTopicosEvitar(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="palavras-evitar" className="text-base font-semibold">
                3. Quais palavras seu agente deve evitar?
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina as palavras que o seu Agente deve evitar. Isso ajuda o Agente a entender o que ele não deve dizer.
              </p>
              <Textarea
                id="palavras-evitar"
                placeholder="Liste as palavras que devem ser evitadas..."
                value={palavrasEvitar}
                onChange={(e) => setPalavrasEvitar(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="links-permitidos" className="text-base font-semibold">
                4. Links Permitidos
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina os links que o seu Agente pode usar. Isso ajuda o Agente a entender quais links ele pode utilizar.
              </p>
              <Textarea
                id="links-permitidos"
                placeholder="Liste os links permitidos..."
                value={linksPermitidos}
                onChange={(e) => setLinksPermitidos(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regras-personalizadas" className="text-base font-semibold">
                5. Regras Personalizadas
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Defina regras adicionais para o seu Agente. Isso ajuda o Agente a entender o que ele deve fazer.
              </p>
              <Textarea
                id="regras-personalizadas"
                placeholder="Digite regras personalizadas..."
                value={regrasPersonalizadas}
                onChange={(e) => setRegrasPersonalizadas(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>RESPOSTAS DE ERRO</CardTitle>
            <CardDescription>
              Em casos de falha de configuração, problemas na API, entre outros, o Agente pode responder com mensagens de erro.
              Se você se aperceber de alguma mensagem de erro, nos informe imediatamente sobre o erro ocorrido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="resposta-padrao-erro" className="text-base font-semibold">
                1. Resposta Padrão
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Deixe em branco caso não tenha
              </p>
              <Textarea
                id="resposta-padrao-erro"
                placeholder="Digite a resposta padrão de erro..."
                value={respostaPadraoErro}
                onChange={(e) => setRespostaPadraoErro(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resposta-secundaria-erro" className="text-base font-semibold">
                2. Resposta Secundária
              </Label>
              <p className="text-sm text-muted-foreground italic">
                Deixe em branco caso não tenha
              </p>
              <Textarea
                id="resposta-secundaria-erro"
                placeholder="Digite a resposta secundária de erro..."
                value={respostaSecundariaErro}
                onChange={(e) => setRespostaSecundariaErro(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <WhatsAppConnection agentId={id!} agentName={nome || "Agente"} />
      </main>
      <TrialExpiredDialog open={showTrialExpired} onOpenChange={setShowTrialExpired} />
      <PlanExpiredDialog 
        open={showPlanExpired} 
        onOpenChange={setShowPlanExpired} 
        planName={currentPlanName}
      />
      <PlanExpiredDialog 
        open={showPlanWarning} 
        onOpenChange={setShowPlanWarning} 
        planName={currentPlanName}
        daysUntilExpiration={daysUntilExpiration}
      />
      <Footer />
    </div>
  );
};

export default Agent;