import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TeamMember {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  created_at: string;
}

interface Agent {
  id: string;
  nome: string;
}

export const TeamDialog = ({ open, onOpenChange }: TeamDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [showAgentSelection, setShowAgentSelection] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchAgents();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      console.error("Error fetching agents:", error);
    }
  };

  const handleInviteMember = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, insira um email.",
      });
      return;
    }

    setLoading(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Insert team member
      const { data: member, error: memberError } = await supabase
        .from("team_members")
        .insert({
          owner_id: user.data.user?.id,
          invited_email: email,
          role: role,
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // If specific agents selected, add agent access
      if (showAgentSelection && selectedAgents.length > 0 && member) {
        const agentAccess = selectedAgents.map(agentId => ({
          team_member_id: member.id,
          agent_id: agentId,
        }));

        const { error: accessError } = await supabase
          .from("team_member_agent_access")
          .insert(agentAccess);

        if (accessError) throw accessError;
      }

      toast({
        title: "Membro convidado",
        description: `Convite enviado para ${email}`,
      });

      setEmail("");
      setRole("user");
      setSelectedAgents([]);
      setShowAgentSelection(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao convidar membro",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Membro removido",
        description: "O membro foi removido da equipe.",
      });

      fetchTeamMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao remover membro",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Equipe</DialogTitle>
          <DialogDescription>
            Convide novos membros para usar sua conta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite new member form */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar Novo Membro
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Acesso</Label>
              <Select value={role} onValueChange={(value: "admin" | "user") => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="limitAgents"
                  checked={showAgentSelection}
                  onCheckedChange={(checked) => {
                    setShowAgentSelection(checked as boolean);
                    if (!checked) setSelectedAgents([]);
                  }}
                />
                <Label htmlFor="limitAgents" className="cursor-pointer">
                  Limitar acesso a agentes específicos
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para permitir acesso a todos os agentes
              </p>
            </div>

            {showAgentSelection && (
              <div className="space-y-2 border rounded p-3 bg-background">
                <Label>Agentes Permitidos</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={agent.id}
                        checked={selectedAgents.includes(agent.id)}
                        onCheckedChange={() => toggleAgentSelection(agent.id)}
                      />
                      <Label htmlFor={agent.id} className="cursor-pointer text-sm">
                        {agent.nome}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleInviteMember} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Convite"}
            </Button>
          </div>

          {/* Team members list */}
          <div className="space-y-4">
            <h3 className="font-semibold">Membros da Equipe</h3>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum membro convidado ainda
              </p>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{member.invited_email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {member.role === "admin" ? "Admin" : "User"}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          member.status === "active" 
                            ? "bg-green-500/10 text-green-500" 
                            : "bg-yellow-500/10 text-yellow-500"
                        }`}>
                          {member.status === "active" ? "Ativo" : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMember(member.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
