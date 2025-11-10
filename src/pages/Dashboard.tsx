import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Plus, FileText, Shield } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  nome: string;
  email: string;
  plano: string;
  created_at: string;
}

interface Agent {
  id: string;
  user_id: string;
  nome: string | null;
  quem_eh: string | null;
  o_que_faz: string | null;
  objetivo: string | null;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

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
    if (session?.user) {
      loadDashboardData();
    }
  }, [session]);

  const loadDashboardData = async () => {
    if (!session?.user) return;

    try {
      const [profileResult, agentsResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("agents").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (agentsResult.error) throw agentsResult.error;

      setProfile(profileResult.data);
      setAgents(agentsResult.data || []);
      setIsAdmin(!!roleResult.data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleCreateAgent = async () => {
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from("agents")
        .insert([{ user_id: session.user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Agente criado!",
        description: "Configure seu novo agente.",
      });

      navigate(`/agent/${data.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar agente",
        description: error.message,
      });
    }
  };

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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">AI</span>
            </div>
            <h1 className="text-xl font-bold">Ajudo Seu Negócio IA</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="secondary" onClick={() => navigate("/admin")}>
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bem-vindo, {profile?.nome || "Usuário"}! 👋
          </h2>
          <p className="text-muted-foreground">
            Gerencie seus agentes de IA e acompanhe seu plano
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Acesse o painel de admin para alterar planos"
                  : "Entre em contato com o suporte para alterar seu plano"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={`${getPlanColor(profile?.plano || "Básico")} text-lg px-4 py-2`}>
                {profile?.plano || "Básico"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold">Email:</span> {profile?.email}
              </div>
              <div>
                <span className="font-semibold">Membro desde:</span>{" "}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("pt-BR")
                  : "-"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meus Agentes</CardTitle>
                <CardDescription>
                  Crie e gerencie seus agentes de IA
                </CardDescription>
              </div>
              <Button onClick={handleCreateAgent}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Novo Agente
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhum agente criado</p>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro agente para começar
                </p>
                <Button onClick={handleCreateAgent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Agente
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/agent/${agent.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {agent.nome || "Sem nome"}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {agent.quem_eh || "Sem descrição"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Última edição:{" "}
                        {new Date(agent.updated_at).toLocaleDateString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;