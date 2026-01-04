import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ArrowLeft, Users, Bot, MessageSquare, MessagesSquare, Eye, Trash2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface User {
  id: string;
  email: string;
  nome: string;
  plano: string;
  celular: string | null;
  created_at: string;
  is_admin: boolean;
  agents_count: number;
  conversations_count: number;
  messages_count: number;
  agents: Agent[];
}

interface Agent {
  id: string;
  nome: string | null;
  created_at: string;
  conversations_count: number;
  messages_count: number;
}

type DateFilter = "today" | "week" | "month" | "all" | "custom";

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, dateFilter, customStartDate, customEndDate]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "custom":
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) endDate = new Date(customEndDate + "T23:59:59.999Z");
        break;
      case "all":
      default:
        startDate = null;
        endDate = null;
    }

    return { startDate, endDate };
  };

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) throw roleError;

      if (!roleData) {
        toast.error("Acesso negado", {
          description: "Você não tem permissão para acessar esta página.",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      console.error("Error checking admin access:", error);
      toast.error("Erro ao verificar permissões");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { startDate, endDate } = getDateRange();

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, nome, plano, celular, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get all agents
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("id, user_id, nome, created_at");

      if (agentsError) throw agentsError;

      // Get all conversations with date filter
      let conversationsQuery = supabase
        .from("whatsapp_conversations")
        .select("id, agent_id, created_at");

      if (startDate) {
        conversationsQuery = conversationsQuery.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        conversationsQuery = conversationsQuery.lte("created_at", endDate.toISOString());
      }

      const { data: conversations, error: conversationsError } = await conversationsQuery;
      if (conversationsError) throw conversationsError;

      // Get all messages with date filter
      let messagesQuery = supabase
        .from("whatsapp_messages")
        .select("id, conversation_id, created_at");

      if (startDate) {
        messagesQuery = messagesQuery.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        messagesQuery = messagesQuery.lte("created_at", endDate.toISOString());
      }

      const { data: messages, error: messagesError } = await messagesQuery;
      if (messagesError) throw messagesError;

      // Create lookup maps
      const agentsByUser = new Map<string, Agent[]>();
      agents?.forEach(agent => {
        const existing = agentsByUser.get(agent.user_id) || [];
        existing.push({
          id: agent.id,
          nome: agent.nome,
          created_at: agent.created_at,
          conversations_count: 0,
          messages_count: 0,
        });
        agentsByUser.set(agent.user_id, existing);
      });

      // Count conversations per agent
      const conversationsByAgent = new Map<string, number>();
      const conversationIds = new Set<string>();
      conversations?.forEach(conv => {
        conversationsByAgent.set(conv.agent_id, (conversationsByAgent.get(conv.agent_id) || 0) + 1);
        conversationIds.add(conv.id);
      });

      // Count messages per conversation
      const messagesByConversation = new Map<string, number>();
      messages?.forEach(msg => {
        if (conversationIds.has(msg.conversation_id)) {
          messagesByConversation.set(msg.conversation_id, (messagesByConversation.get(msg.conversation_id) || 0) + 1);
        }
      });

      // Calculate messages per agent
      const messagesByAgent = new Map<string, number>();
      conversations?.forEach(conv => {
        const msgCount = messagesByConversation.get(conv.id) || 0;
        messagesByAgent.set(conv.agent_id, (messagesByAgent.get(conv.agent_id) || 0) + msgCount);
      });

      // Update agent stats
      agentsByUser.forEach((agentList, userId) => {
        agentList.forEach(agent => {
          agent.conversations_count = conversationsByAgent.get(agent.id) || 0;
          agent.messages_count = messagesByAgent.get(agent.id) || 0;
        });
      });

      // Combine data
      const usersWithStats = profiles?.map(profile => {
        const userAgents = agentsByUser.get(profile.id) || [];
        const conversationsCount = userAgents.reduce((sum, a) => sum + a.conversations_count, 0);
        const messagesCount = userAgents.reduce((sum, a) => sum + a.messages_count, 0);

        return {
          ...profile,
          is_admin: roles?.some(r => r.user_id === profile.id && r.role === "admin") || false,
          agents_count: userAgents.length,
          conversations_count: conversationsCount,
          messages_count: messagesCount,
          agents: userAgents,
        };
      }) || [];

      setUsers(usersWithStats);

      // Calculate totals
      setTotalUsers(usersWithStats.length);
      setTotalAgents(agents?.length || 0);
      setTotalConversations(conversations?.length || 0);
      setTotalMessages(messages?.length || 0);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários");
    }
  };

  const handlePlanChange = async (userId: string, newPlan: "Plano Teste Grátis" | "Básico" | "Avançado" | "Empresarial") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ plano: newPlan })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Plano atualizado com sucesso");
      await loadUsers();
    } catch (error: any) {
      console.error("Error updating plan:", error);
      toast.error("Erro ao atualizar plano");
    }
  };

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    try {
      if (currentIsAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Permissão de admin removida");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Permissão de admin concedida");
      }

      await loadUsers();
    } catch (error: any) {
      console.error("Error toggling admin role:", error);
      toast.error("Erro ao alterar permissões");
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Delete user's agents (this will cascade to conversations and messages)
      const { error: agentsError } = await supabase
        .from("agents")
        .delete()
        .eq("user_id", userToDelete.id);

      if (agentsError) throw agentsError;

      // Delete user's team members
      const { error: teamError } = await supabase
        .from("team_members")
        .delete()
        .eq("owner_id", userToDelete.id);

      if (teamError) console.error("Error deleting team members:", teamError);

      // Delete user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userToDelete.id);

      if (profileError) throw profileError;

      toast.success("Usuário eliminado com sucesso");
      setDeleteUserDialogOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao eliminar usuário: " + error.message);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const viewAgent = (agentId: string) => {
    navigate(`/agent/${agentId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 animate-gradient-shift bg-[length:200%_200%]">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-glow-pulse">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Painel de Administração</h1>
              <p className="text-muted-foreground">Gerencie usuários e visualize estatísticas</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="shadow-lg hover:shadow-glow transition-all duration-300">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-scale">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Bot className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAgents}</p>
                  <p className="text-sm text-muted-foreground">Agentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <MessageSquare className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalConversations}</p>
                  <p className="text-sm text-muted-foreground">Conversas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <MessagesSquare className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMessages}</p>
                  <p className="text-sm text-muted-foreground">Mensagens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-primary/20 animate-fade-in-scale">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filtros de Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm font-medium mb-2 block">Período</label>
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Última Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="all">Todo o Período</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateFilter === "custom" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Data Início</label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Data Fim</label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="space-y-4 animate-fade-in-scale">
          <h2 className="text-xl font-semibold">Usuários ({users.length})</h2>
          {users.map((user, index) => (
            <Collapsible key={user.id} open={expandedUsers.has(user.id)} onOpenChange={() => toggleUserExpanded(user.id)}>
              <Card className="border-primary/20 hover:border-primary/40 transition-all duration-300" style={{ animationDelay: `${0.1 + index * 0.02}s` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {user.nome}
                        {user.is_admin && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Admin
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {user.email} {user.celular && `• ${user.celular}`}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cadastrado em: {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {expandedUsers.has(user.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-semibold">{user.agents_count}</p>
                      <p className="text-xs text-muted-foreground">Agentes</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-semibold">{user.conversations_count}</p>
                      <p className="text-xs text-muted-foreground">Conversas</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-semibold">{user.messages_count}</p>
                      <p className="text-xs text-muted-foreground">Mensagens</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-sm font-semibold">{user.plano}</p>
                      <p className="text-xs text-muted-foreground">Plano</p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Plano:</label>
                      <Select
                        value={user.plano}
                        onValueChange={(value) => handlePlanChange(user.id, value as "Plano Teste Grátis" | "Básico" | "Avançado" | "Empresarial")}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Plano Teste Grátis">Plano Teste Grátis</SelectItem>
                          <SelectItem value="Básico">Básico</SelectItem>
                          <SelectItem value="Avançado">Avançado</SelectItem>
                          <SelectItem value="Empresarial">Empresarial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant={user.is_admin ? "destructive" : "secondary"}
                      size="sm"
                      onClick={() => toggleAdminRole(user.id, user.is_admin)}
                    >
                      {user.is_admin ? "Remover Admin" : "Tornar Admin"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setUserToDelete(user);
                        setDeleteUserDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>

                  {/* Expanded Agents Section */}
                  <CollapsibleContent className="mt-4">
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Agentes ({user.agents.length})</h4>
                      {user.agents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum agente criado</p>
                      ) : (
                        <div className="space-y-2">
                          {user.agents.map((agent) => (
                            <div
                              key={agent.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{agent.nome || "Sem nome"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {agent.conversations_count} conversas • {agent.messages_count} mensagens
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewAgent(agent.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Visualizar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        {users.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja eliminar o usuário <strong>{userToDelete?.nome}</strong> ({userToDelete?.email})?
              <br /><br />
              Esta ação irá eliminar permanentemente:
              <ul className="list-disc list-inside mt-2">
                <li>O perfil do usuário</li>
                <li>Todos os agentes ({userToDelete?.agents_count})</li>
                <li>Todas as conversas ({userToDelete?.conversations_count})</li>
                <li>Todas as mensagens ({userToDelete?.messages_count})</li>
              </ul>
              <br />
              <strong className="text-destructive">Esta ação não pode ser desfeita!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;