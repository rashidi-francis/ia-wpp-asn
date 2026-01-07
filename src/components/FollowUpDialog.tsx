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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, MessageSquare } from "lucide-react";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface FollowUpSettings {
  id?: string;
  agent_id: string;
  enabled: boolean;
  delay_type: string;
  custom_message: string | null;
}

export function FollowUpDialog({ open, onOpenChange, agentId }: FollowUpDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FollowUpSettings>({
    agent_id: agentId,
    enabled: false,
    delay_type: "24h",
    custom_message: null,
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
        .from("agent_followup_settings")
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
          delay_type: "24h",
          custom_message: null,
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações de follow-up:", error);
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
        // Update existing
        const { error } = await supabase
          .from("agent_followup_settings")
          .update({
            enabled: settings.enabled,
            delay_type: settings.delay_type,
            custom_message: settings.custom_message || null,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("agent_followup_settings")
          .insert({
            agent_id: agentId,
            enabled: settings.enabled,
            delay_type: settings.delay_type,
            custom_message: settings.custom_message || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de follow-up foram atualizadas.",
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

  const delayOptions = [
    { value: "30min", label: "30 minutos", description: "A IA enviará uma mensagem após 30 minutos sem resposta" },
    { value: "24h", label: "24 horas", description: "A IA enviará uma mensagem após 24 horas sem resposta" },
    { value: "3d", label: "3 dias", description: "A IA enviará uma mensagem após 3 dias sem resposta" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Configurar Follow-up
          </DialogTitle>
          <DialogDescription>
            Configure mensagens automáticas para reengajar leads que pararam de responder.
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
                  Ativar Follow-up
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que a IA envie mensagens de reengajamento
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
                <div className="space-y-3">
                  <Label className="text-base">Tempo de espera</Label>
                  <RadioGroup
                    value={settings.delay_type}
                    onValueChange={(value) =>
                      setSettings({ ...settings, delay_type: value })
                    }
                    className="space-y-2"
                  >
                    {delayOptions.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={option.value} className="font-medium cursor-pointer">
                            {option.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="custom_message" className="text-base">
                      Mensagem personalizada (opcional)
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deixe em branco para que a IA continue a conversa naturalmente.
                  </p>
                  <AutoResizeTextarea
                    id="custom_message"
                    placeholder="Ex: Olá! Percebi que você ainda não respondeu. Posso ajudar com mais alguma coisa?"
                    value={settings.custom_message || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, custom_message: e.target.value })
                    }
                    className="min-h-[80px]"
                  />
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
