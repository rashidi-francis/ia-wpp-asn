import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface CalendarSettings {
  id?: string;
  agent_id: string;
  enabled: boolean;
  google_refresh_token: string | null;
  google_calendar_id: string | null;
}

export function CalendarDialog({ open, onOpenChange, agentId }: CalendarDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>({
    agent_id: agentId,
    enabled: false,
    google_refresh_token: null,
    google_calendar_id: null,
  });

  useEffect(() => {
    if (open && agentId) {
      loadSettings();
    }
  }, [open, agentId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_calendar_settings")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        setSettings({
          agent_id: agentId,
          enabled: false,
          google_refresh_token: null,
          google_calendar_id: null,
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações de calendário:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar configurações",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from("agent_calendar_settings")
          .update({
            enabled: settings.enabled,
            google_calendar_id: settings.google_calendar_id || null,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_calendar_settings")
          .insert({
            agent_id: agentId,
            enabled: settings.enabled,
            google_calendar_id: settings.google_calendar_id || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de agenda foram atualizadas.",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const isConnected = !!settings.google_refresh_token;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Conectar Agenda
          </DialogTitle>
          <DialogDescription>
            Conecte sua agenda Google para que a IA possa verificar disponibilidade e criar agendamentos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="text-base">
                  Ativar Agendamentos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que a IA gerencie agendamentos
                </p>
              </div>
              <Switch
                id="enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enabled: checked })
                }
              />
            </div>

            {settings.enabled && (
              <>
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Google Calendar Conectado
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        A IA pode verificar disponibilidade e criar eventos
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calendar_id" className="text-base">
                    Endereço do Calendário (opcional)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Informe o e-mail associado ao calendário. Deixe em branco para usar o calendário principal da conta.
                  </p>
                  <Input
                    id="calendar_id"
                    placeholder="Ex: seuemail@gmail.com"
                    value={settings.google_calendar_id || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, google_calendar_id: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 O e-mail do calendário é o mesmo usado para fazer login no Google
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
