import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Plus, FileText, Shield, Settings, Trash2 } from "lucide-react";
import emailjs from '@emailjs/browser';

emailjs.init('NmeVuycVzIv4cDkxi');
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

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

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", agentToDelete.id);

      if (error) throw error;

      // Enviar e-mail via EmailJS
      try {
        const templateParams = {
          user_email: profile?.email || session?.user?.email,
          user_name: profile?.nome || session?.user?.email,
          agent_name: agentToDelete.nome || "Sem nome",
          date: new Date().toLocaleString('pt-BR'),
        };

        await emailjs.send(
          'service_mibcy3e',
          'template_342qh08',
          templateParams
        );
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }

      toast({
        title: "Agente eliminado",
        description: `O agente ${agentToDelete.nome || "Sem nome"} foi eliminado permanentemente.`,
      });

      setAgents(agents.filter((a) => a.id !== agentToDelete.id));
      setConfirmDeleteOpen(false);
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao eliminar agente",
        description: error.message,
      });
    }
  };

  const initiateDelete = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleFirstConfirm = () => {
    setDeleteDialogOpen(false);
    setConfirmDeleteOpen(true);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 animate-gradient-shift bg-[length:200%_200%]">
      <header className="border-b border-primary/20 bg-card/80 backdrop-blur-xl shadow-lg sticky top-0 z-10 animate-fade-in">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-glow-pulse">
              <span className="text-lg font-bold text-primary-foreground">AI</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Ajudo Seu Negócio IA</h1>
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
        <div className="mb-8 animate-slide-up">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Bem-vindo, {profile?.nome || "Usuário"}!
            </span>{" "}
            <span className="inline-block animate-wave">👋</span>
          </h2>
          <p className="text-muted-foreground">
            Gerencie seus agentes de IA e acompanhe seu plano
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8 animate-fade-in-scale" style={{ animationDelay: "0.1s" }}>
          <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-glow">
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

          <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-glow">
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

        <Card className="border-primary/20 animate-fade-in-scale" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meus Agentes</CardTitle>
                <CardDescription>
                  Crie e gerencie seus agentes de IA
                </CardDescription>
              </div>
                <Button onClick={handleCreateAgent} className="shadow-lg hover:shadow-glow transition-all duration-300">
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
                <Button onClick={handleCreateAgent} className="shadow-lg hover:shadow-glow transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Agente
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className="relative border-primary/20 hover:border-primary/40 hover:shadow-glow transition-all duration-300 transform hover:scale-[1.02] animate-fade-in-scale group"
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/agent/${agent.id}`)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Configurações
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => initiateDelete(agent)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar Agente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg pr-8">
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

      {/* Primeiro diálogo de confirmação */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar Agente {agentToDelete?.nome || "Sem nome"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja eliminar este agente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Segundo diálogo de confirmação */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atenção! Ação Irreversível</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a apagar para sempre o Agente{" "}
                <strong>{agentToDelete?.nome || "Sem nome"}</strong>.
              </p>
              <p>
                Se continuar, você perderá todas as informações e instruções
                que inseriu nele até agora.
              </p>
              <p className="font-semibold">Deseja mesmo prosseguir?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setConfirmDeleteOpen(false);
                setAgentToDelete(null);
              }}
              className="w-full sm:w-auto"
            >
              Desejo manter o Agente {agentToDelete?.nome || "Sem nome"} em
              minha conta
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
            >
              Sim, excluir Agente {agentToDelete?.nome || "Sem nome"}{" "}
              permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;