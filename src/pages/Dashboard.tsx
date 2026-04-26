import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Plus, FileText, Shield, Settings, Trash2, User, Users, MessageSquare, Clock, AlertCircle, HelpCircle, RefreshCw, Calendar, Image, Play } from "lucide-react";
import emailjs from '@emailjs/browser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "@/components/ProfileDialog";
import { PlanDialog } from "@/components/PlanDialog";
import { TeamDialog } from "@/components/TeamDialog";
import { PlanExpiredDialog } from "@/components/PlanExpiredDialog";
import { SupportFAQDialog } from "@/components/SupportFAQDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { CalendarDialog } from "@/components/CalendarDialog";
import { AgentPhotosDialog } from "@/components/AgentPhotosDialog";
import { VideoTutorialDialog } from "@/components/VideoTutorialDialog";
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
import { Footer } from "@/components/Footer";

interface Profile {
  id: string;
  nome: string;
  email: string;
  plano: string;
  created_at: string;
  plan_expires_at: string | null;
}

interface PlanLimits {
  max_agents: number;
  max_team_members: number;
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
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({ max_agents: 0, max_team_members: 0 });
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [planExpirationWarningOpen, setPlanExpirationWarningOpen] = useState(false);
  const [daysUntilExpiration, setDaysUntilExpiration] = useState<number | undefined>();
  const [, setNowTick] = useState(Date.now());

  // Tick every minute so trial countdown stays accurate
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Meta Pixel CompleteRegistration é disparado pelo Google Tag Manager
  // (lê a flag 'pending_registration_event' do localStorage setada no Login.tsx)
  
  // Dialog states for agent settings
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [videoTutorialDialogOpen, setVideoTutorialDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
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
      // Use maybeSingle() to handle case where profile doesn't exist yet
      const [profileResult, agentsResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase.from("agents").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (agentsResult.error) throw agentsResult.error;

      let profileData = profileResult.data;

      // If profile doesn't exist (e.g., Google OAuth user), create it
      if (!profileData) {
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: session.user.id,
            email: session.user.email || '',
            nome: session.user.user_metadata?.full_name || session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Usuário',
            plano: 'Plano Teste Grátis',
            celular: session.user.user_metadata?.celular || null,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          throw new Error('Não foi possível criar o perfil. Por favor, tente novamente.');
        }
        
        profileData = newProfile;
      }

      setProfile(profileData);
      setAgents(agentsResult.data || []);
      setIsAdmin(!!roleResult.data);

      // Check plan expiration for paid plans
      if (profileData.plan_expires_at && profileData.plano !== "Plano Teste Grátis") {
        const expiresAt = new Date(profileData.plan_expires_at);
        const now = new Date();
        const diffInDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysUntilExpiration(diffInDays);
        
        // Show warning if expiring within 7 days
        if (diffInDays <= 7 && diffInDays > 0) {
          setPlanExpirationWarningOpen(true);
        }
      }

      // Get plan limits
      const { data: limitsData } = await supabase
        .rpc("get_plan_limits", { plan_name: profileData.plano });
      
      if (limitsData && limitsData.length > 0) {
        setPlanLimits(limitsData[0]);
      }
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

    // Check if user has reached agent limit
    if (agents.length >= planLimits.max_agents) {
      setLimitDialogOpen(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("agents")
        .insert([{ user_id: session.user.id }])
        .select()
        .single();

      if (error) {
        // Check if error is due to RLS policy (plan limit)
        if (error.message.includes("policy")) {
          throw new Error(`Você atingiu o limite de ${planLimits.max_agents} agentes do seu plano ${profile?.plano}.`);
        }
        throw error;
      }

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
        // Inicializar EmailJS aqui para garantir que está configurado
        emailjs.init('NmeVuycVzIv4cDkxi');
        
        const templateParams = {
          user_email: profile?.email || session?.user?.email || 'email@nao-encontrado.com',
          user_name: profile?.nome || session?.user?.email || 'Usuário',
          agent_name: agentToDelete.nome || "Sem nome",
          date: new Date().toLocaleString('pt-BR'),
        };

        console.log('🔍 Tentando enviar email com params:', templateParams);
        console.log('🔍 Service ID: service_mibcy3e');
        console.log('🔍 Template ID: template_342qh08');
        console.log('🔍 Public Key: NmeVuycVzIv4cDkxi');

        // Tentar enviar sem passar a public key novamente (já inicializado)
        const emailRes = await emailjs.send(
          'service_mibcy3e',
          'template_342qh08',
          templateParams
        );
        
        console.log('✅ EmailJS enviado com sucesso:', emailRes);
        toast({ 
          title: '✅ Email enviado', 
          description: 'O time foi notificado sobre a exclusão do agente.' 
        });
      } catch (emailError: any) {
        console.error('❌ Erro completo ao enviar email:', emailError);
        console.error('❌ Status:', emailError?.status);
        console.error('❌ Text:', emailError?.text);
        console.error('❌ Message:', emailError?.message);
        toast({
          variant: 'destructive',
          title: '❌ Falha ao enviar email',
          description: emailError?.text || emailError?.message || 'Erro desconhecido. Veja o console.',
        });
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
        return "bg-accent text-accent-foreground";
      case "Empresarial":
        return "bg-primary text-primary-foreground";
      case "Plano Teste Grátis":
        return "bg-amber-500 text-white font-semibold";
      default:
        return "bg-muted text-muted-foreground";
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-glow-pulse shrink-0">
              <span className="text-base sm:text-lg font-bold text-primary-foreground">AI</span>
            </div>
            <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
              <span className="sm:hidden">ChatASN</span>
              <span className="hidden sm:inline">Ajudo Seu Negócio IA</span>
            </h1>
          </div>
        <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="px-2 sm:px-3">
                <Shield className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setVideoTutorialDialogOpen(true)}
              className="relative overflow-visible animate-neon-pulse border-cyan-400/50 hover:border-cyan-400 px-2 sm:px-3"
            >
              <span className="absolute inset-0 rounded-md animate-neon-glow" />
              <Play className="h-4 w-4 text-cyan-500 sm:mr-2" />
              <span className="hidden sm:inline bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent font-semibold">
                Vídeo Tutorial
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 sm:px-3">
                  <User className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Minha Conta</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPlanDialogOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Meu Plano
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTeamDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Equipes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSupportDialogOpen(true)}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Suporte
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  : "Para alterar seu plano, acesse: Minha Conta > Meu Plano"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={`${getPlanColor(profile?.plano || "Básico")} text-lg px-4 py-2`}>
                {profile?.plano || "Básico"}
              </Badge>
              
              {/* Expiration info - show for all plans */}
              {profile?.plano === "Plano Teste Grátis" ? (
                (() => {
                  const createdDate = new Date(profile.created_at);
                  const trialExpiration = new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
                  const now = new Date();
                  const diffInMs = trialExpiration.getTime() - now.getTime();
                  const diffInHours = Math.ceil(diffInMs / (1000 * 60 * 60));
                  const diffInMinutes = Math.ceil(diffInMs / (1000 * 60));
                  const isExpired = diffInMs <= 0;

                  let remainingLabel = '';
                  if (!isExpired) {
                    if (diffInHours > 1) {
                      remainingLabel = `${diffInHours} horas`;
                    } else if (diffInMinutes > 1) {
                      remainingLabel = `${diffInMinutes} minutos`;
                    } else {
                      remainingLabel = 'menos de 1 minuto';
                    }
                  }

                  return (
                    <div className={`flex items-center gap-2 text-sm ${
                      isExpired ? 'text-destructive' : diffInHours <= 4 ? 'text-yellow-600' : 'text-muted-foreground'
                    }`}>
                      {isExpired ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      <span>
                        {isExpired
                          ? 'Período de teste expirado - Faça upgrade'
                          : `Expira em ${trialExpiration.toLocaleDateString('pt-BR')} (${remainingLabel})`
                        }
                      </span>
                    </div>
                  );
                })()
              ) : profile?.plan_expires_at ? (
                <div className={`flex items-center gap-2 text-sm ${
                  daysUntilExpiration !== undefined && daysUntilExpiration <= 7 
                    ? daysUntilExpiration <= 0 
                      ? 'text-destructive' 
                      : 'text-yellow-600'
                    : 'text-muted-foreground'
                }`}>
                  {daysUntilExpiration !== undefined && daysUntilExpiration <= 0 ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  <span>
                    {daysUntilExpiration !== undefined && daysUntilExpiration <= 0 
                      ? 'Plano expirado - Renove agora'
                      : `Expira em ${new Date(profile.plan_expires_at).toLocaleDateString('pt-BR')}`
                    }
                    {daysUntilExpiration !== undefined && daysUntilExpiration > 0 && daysUntilExpiration <= 7 && (
                      <span className="font-semibold"> ({daysUntilExpiration} {daysUntilExpiration === 1 ? 'dia' : 'dias'})</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Vitalício</span>
                </div>
              )}
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
                  Você tem {agents.length} de {planLimits.max_agents} agentes ({planLimits.max_agents - agents.length} restantes)
                </CardDescription>
              </div>
                <Button 
                  onClick={handleCreateAgent} 
                  className="shadow-lg hover:shadow-glow transition-all duration-300"
                >
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
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setFollowUpDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Follow-up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setCalendarDialogOpen(true);
                            }}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Conectar Agenda
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setPhotosDialogOpen(true);
                            }}
                          >
                            <Image className="mr-2 h-4 w-4" />
                            Fotos e PDFs
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/agent/${agent.id}/chats`)}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Chat
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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

      {/* Diálogo de limite de agentes atingido */}
      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              🔒 Limite de Agentes Atingido
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  O limite de agentes do <strong>{profile?.plano}</strong> já foi atingido.
                </p>
                <p>
                  Para criar novos agentes, acesse:<br />
                  <strong>Minha Conta &gt; Meu Plano</strong><br />
                  {profile?.plano === "Empresarial" ? (
                    <>
                      escolha o plano: <strong>"Agency Boss"</strong> que é um plano flexível sob demanda, lá mesmo tem um botão "Fale com a nossa equipe" para que possamos explorar algo personalizado para a sua demanda.
                    </>
                  ) : (
                    <>
                      e faça o upgrade para um dos planos disponíveis:
                    </>
                  )}
                </p>
                {profile?.plano !== "Empresarial" && (
                  <ul className="list-disc list-inside space-y-1">
                    {profile?.plano === "Básico" && (
                      <>
                        <li><strong>Plano Avançado</strong> – até 3 agentes</li>
                        <li><strong>Plano Empresarial</strong> – até 6 agentes</li>
                      </>
                    )}
                    {profile?.plano === "Avançado" && (
                      <li><strong>Plano Empresarial</strong> – até 6 agentes</li>
                    )}
                    {profile?.plano === "Plano Teste Grátis" && (
                      <>
                        <li><strong>Plano Básico</strong> – até 1 agente</li>
                        <li><strong>Plano Avançado</strong> – até 3 agentes</li>
                        <li><strong>Plano Empresarial</strong> – até 6 agentes</li>
                      </>
                    )}
                  </ul>
                )}
                <p className="font-medium text-foreground">
                  Faça o upgrade e continue expandindo seus agentes sem interrupções.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLimitDialogOpen(false);
                setPlanDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Fazer Upgrade Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={profile}
        onProfileUpdate={loadDashboardData}
      />

      <PlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        profile={profile}
      />

      <TeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
      />

      <PlanExpiredDialog
        open={planExpirationWarningOpen}
        onOpenChange={setPlanExpirationWarningOpen}
        planName={profile?.plano || ""}
        daysUntilExpiration={daysUntilExpiration}
      />

      <SupportFAQDialog
        open={supportDialogOpen}
        onOpenChange={setSupportDialogOpen}
      />

      {/* Agent settings dialogs */}
      {selectedAgentId && (
        <>
          <FollowUpDialog
            open={followUpDialogOpen}
            onOpenChange={(open) => {
              setFollowUpDialogOpen(open);
              if (!open) setSelectedAgentId(null);
            }}
            agentId={selectedAgentId}
          />
          <CalendarDialog
            open={calendarDialogOpen}
            onOpenChange={(open) => {
              setCalendarDialogOpen(open);
              if (!open) setSelectedAgentId(null);
            }}
            agentId={selectedAgentId}
          />
          <AgentPhotosDialog
            open={photosDialogOpen}
            onOpenChange={(open) => {
              setPhotosDialogOpen(open);
              if (!open) setSelectedAgentId(null);
            }}
            agentId={selectedAgentId}
          />
        </>
      )}
      
      <VideoTutorialDialog
        open={videoTutorialDialogOpen}
        onOpenChange={setVideoTutorialDialogOpen}
      />
      <Footer />
    </div>
  );
};

export default Dashboard;