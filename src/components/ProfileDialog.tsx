import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    nome: string;
    email: string;
    created_at: string;
  } | null;
  onProfileUpdate: () => void;
}

export const ProfileDialog = ({ open, onOpenChange, profile, onProfileUpdate }: ProfileDialogProps) => {
  const { toast } = useToast();
  const [nome, setNome] = useState(profile?.nome || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome })
        .eq("id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      onProfileUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem.",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>
            Gerencie suas informações pessoais
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Membro desde</Label>
              <Input
                value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "-"}
                disabled
                className="bg-muted"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar Perfil"}
            </Button>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold">Alterar Senha</h3>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={loading || !newPassword || !confirmPassword}
              variant="secondary"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar Senha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
