import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ArrowLeft, Users, Bot, MessageSquare, MessagesSquare, Eye, Trash2, RefreshCw, Infinity, Search } from "lucide-react";
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
  plan_expires_at: string | null;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
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
  }, [isAdmin, dateFilter]);

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
        .select("id, email, nome, plano, celular, created_at, plan_expires_at")
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
      agentsByUser.forEach((agentList) => {
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

  const handleRenewPlan = async (userId: string, type: "30days" | "lifetime") => {
    try {
      let newExpiresAt: string | null = null;
      
      if (type === "30days") {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 30);
        newExpiresAt = newDate.toISOString();
      } else {
        // Vitalício = null (nunca expira)
        newExpiresAt = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ plan_expires_at: newExpiresAt })
        .eq("id", userId);

      if (error) throw error;

      toast.success(type === "30days" ? "Renovado por +30 dias" : "Plano definido como Vitalício");
      await loadUsers();
    } catch (error: any) {
      console.error("Error renewing plan:", error);
      toast.error("Erro ao renovar plano");
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

  const getPlanBadgeColor = (plano: string) => {
    switch (plano) {
      case "Empresarial":
        return "bg-blue-600 text-white";
      case "Avançado":
        return "bg-green-600 text-white";
      case "Básico":
        return "bg-gray-500 text-white";
      case "Plano Teste Grátis":
        return "bg-amber-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getExpirationDisplay = (expiresAt: string | null) => {
    if (!expiresAt) return "Vitalício";
    return new Date(expiresAt).toLocaleDateString("pt-BR");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.nome.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

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
    <div className="min-h-screen bg-slate-50">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <span className="text-lg font-bold text-white">O</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Painel de Administração</h1>
              <p className="text-sm text-muted-foreground">Gerencie usuários, agentes e planos</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-50">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-50">
                  <Bot className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAgents}</p>
                  <p className="text-xs text-muted-foreground">Total Agentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-50">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalConversations}</p>
                  <p className="text-xs text-muted-foreground">Total Conversas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-50">
                  <MessagesSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMessages}</p>
                  <p className="text-xs text-muted-foreground">Total Mensagens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Row */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="w-full md:w-96">
            <label className="text-sm font-medium mb-2 block text-muted-foreground">Buscar usuário</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block text-muted-foreground">Período</label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários ({filteredUsers.length})
          </h2>
          
          {filteredUsers.map((user) => (
            <Collapsible key={user.id} open={expandedUsers.has(user.id)} onOpenChange={() => toggleUserExpanded(user.id)}>
              <Card className="bg-white border shadow-sm overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{user.nome}</h3>
                          {user.is_admin && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">Admin</Badge>
                          )}
                          <Badge className={`${getPlanBadgeColor(user.plano)} text-xs`}>
                            {user.plano}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          {user.agents_count} agentes
                        </p>
                        <p className="text-muted-foreground">
                          {user.conversations_count} conversas
                        </p>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t bg-muted/20">
                    {/* User Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Celular:</span>{" "}
                        <span className="font-medium">{user.celular || "Não informado"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cadastro:</span>{" "}
                        <span className="font-medium">{new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expira em:</span>{" "}
                        <span className={`font-medium ${isExpired(user.plan_expires_at) ? 'text-red-600' : ''}`}>
                          {getExpirationDisplay(user.plan_expires_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap gap-3 items-center py-3 border-t">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Plano:</label>
                        <Select
                          value={user.plano}
                          onValueChange={(value) => handlePlanChange(user.id, value as "Plano Teste Grátis" | "Básico" | "Avançado" | "Empresarial")}
                        >
                          <SelectTrigger className="w-[160px] h-8 bg-white">
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
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Renovar:</label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => handleRenewPlan(user.id, "30days")}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          +30 dias
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => handleRenewPlan(user.id, "lifetime")}
                        >
                          <Infinity className="h-3 w-3 mr-1" />
                          Vitalício
                        </Button>
                      </div>

                      <Button
                        variant={user.is_admin ? "destructive" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => toggleAdminRole(user.id, user.is_admin)}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user.is_admin ? "Remover Admin" : "Tornar Admin"}
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteUserDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>

                    {/* Agents Section */}
                    <div className="pt-3 border-t">
                      <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Agentes deste usuário ({user.agents.length})
                      </h4>
                      {user.agents.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Nenhum agente criado</p>
                      ) : (
                        <div className="space-y-2">
                          {user.agents.map((agent) => (
                            <div
                              key={agent.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border"
                            >
                              <div>
                                <p className="font-medium text-sm">{agent.nome || "Sem nome"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Criado em {new Date(agent.created_at).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground">
                                  {agent.conversations_count} conversas
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {agent.messages_count} mensagens
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => viewAgent(agent.id)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Visualizar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}

          {filteredUsers.length === 0 && (
            <Card className="bg-white">
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </CardContent>
            </Card>
          )}
        </div>
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
