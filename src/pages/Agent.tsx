import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Calendar, Save } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

interface Agent {
  id: string;
  user_id: string;
  quem_eh: string | null;
  o_que_faz: string | null;
  objetivo: string | null;
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
  const [quemEh, setQuemEh] = useState("");
  const [oQueFaz, setOQueFaz] = useState("");
  const [objetivo, setObjetivo] = useState("");

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
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      setAgent(data);
      setQuemEh(data.quem_eh || "");
      setOQueFaz(data.o_que_faz || "");
      setObjetivo(data.objetivo || "");
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
      const { error } = await supabase
        .from("agents")
        .update({
          quem_eh: quemEh,
          o_que_faz: oQueFaz,
          objetivo: objetivo,
        })
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) throw error;

      toast({
        title: "Instruções salvas com sucesso! ✓",
        description: "Suas alterações foram salvas.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">AI</span>
            </div>
            <h1 className="text-xl font-bold">Instruções do Agente</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configure seu Agente de IA</CardTitle>
            <CardDescription>
              Preencha as informações abaixo para definir o comportamento do seu agente.
              Os campos não possuem limite de caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="quem-eh" className="text-base font-semibold">
                Quem é o seu agente?
              </Label>
              <Textarea
                id="quem-eh"
                placeholder="Descreva quem é seu agente, seu papel, especialidade..."
                value={quemEh}
                onChange={(e) => setQuemEh(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="o-que-faz" className="text-base font-semibold">
                O que o seu agente faz?
              </Label>
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
                Qual é o objetivo do seu agente?
              </Label>
              <Textarea
                id="objetivo"
                placeholder="Defina os objetivos principais e metas do seu agente..."
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="min-h-[120px] resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Próximo Passo: Conectar WhatsApp à IA
            </CardTitle>
            <CardDescription>
              Agende uma reunião com nosso time para integrar seu WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">
              Após configurar suas instruções, agende uma reunião rápida com nossa equipe.
              Durante a reunião, enviaremos o QR Code para conectar seu número de WhatsApp à IA.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate("/agendar")}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Agendar Conexão WhatsApp na IA
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Agent;