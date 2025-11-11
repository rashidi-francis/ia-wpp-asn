import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";

interface User {
  id: string;
  email: string;
  nome: string;
  plano: string;
  is_admin: boolean;
}

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      // Check if user is admin
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
      await loadUsers();
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
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, nome, plano")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        is_admin: roles?.some(r => r.user_id === profile.id && r.role === "admin") || false,
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários");
    }
  };

  const handlePlanChange = async (userId: string, newPlan: "Básico" | "Avançado" | "Empresarial") => {
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
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Permissão de admin removida");
      } else {
        // Add admin role
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
              <p className="text-muted-foreground">Gerencie usuários e planos</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="shadow-lg hover:shadow-glow transition-all duration-300">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Users List */}
        <div className="grid gap-4 animate-fade-in-scale" style={{ animationDelay: "0.1s" }}>
          {users.map((user, index) => (
            <Card key={user.id} className="border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-glow animate-fade-in-scale" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {user.nome}
                      {user.is_admin && (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                          Admin
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                  <Button
                    variant={user.is_admin ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => toggleAdminRole(user.id, user.is_admin)}
                  >
                    {user.is_admin ? "Remover Admin" : "Tornar Admin"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Plano:</label>
                  <Select
                    value={user.plano}
                    onValueChange={(value) => handlePlanChange(user.id, value as "Básico" | "Avançado" | "Empresarial")}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Básico">Básico</SelectItem>
                      <SelectItem value="Avançado">Avançado</SelectItem>
                      <SelectItem value="Empresarial">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
};

export default Admin;
