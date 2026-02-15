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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { MessageSquareHeart, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

const DELAY_OPTIONS = [
  { value: "10min", label: "10 minutos" },
  { value: "1h", label: "1 hora" },
  { value: "3h", label: "3 horas" },
  { value: "24h", label: "1 dia" },
  { value: "3d", label: "3 dias" },
  { value: "5d", label: "5 dias" },
];

export function FollowUpDialog({ open, onOpenChange, agentId }: FollowUpDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [delayType, setDelayType] = useState("24h");
  const [customMessage, setCustomMessage] = useState("");

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
        setEnabled(data.enabled);
        setDelayType(data.delay_type || "24h");
        setCustomMessage(data.custom_message || "");
      } else {
        // Defaults
        setEnabled(true);
        setDelayType("24h");
        setCustomMessage("");
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações de follow-up:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("agent_followup_settings")
        .select("id")
        .eq("agent_id", agentId)
        .maybeSingle();

      const payload = {
        agent_id: agentId,
        enabled,
        delay_type: delayType,
        custom_message: customMessage.trim() || null,
      };

      if (existing) {
        const { error } = await supabase
          .from("agent_followup_settings")
          .update(payload)
          .eq("agent_id", agentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_followup_settings")
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de follow-up foram atualizadas.",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar follow-up:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Configurar Follow-up
          </DialogTitle>
          <DialogDescription>
            Configure quando e como o agente deve reengajar leads inativos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Follow-up Automático</p>
                <p className="text-sm text-muted-foreground">
                  Reengajar leads que não responderam
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            {enabled && (
              <>
                {/* Delay selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    Tempo de espera antes do reengajamento
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {DELAY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDelayType(option.value)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          delayType === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom message */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Mensagem personalizada (opcional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para usar mensagens variadas automáticas.
                  </p>
                  <AutoResizeTextarea
                    placeholder="Ex: Olá! Vi que você não avançou ainda. Ficou com alguma dúvida?"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>

                {/* Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    ⏰ As mensagens são enviadas apenas em <strong>horário comercial (8h às 18h)</strong>, dias úteis, para não incomodar o cliente.
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
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
