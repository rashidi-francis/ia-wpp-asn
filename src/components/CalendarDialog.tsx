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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CheckCircle2, XCircle, LogOut, ShieldCheck, Eye, CalendarPlus, Ban } from "lucide-react";

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface CalendarStatus {
  connected: boolean;
  enabled: boolean;
  calendarEmail: string | null;
}

export function CalendarDialog({ open, onOpenChange, agentId }: CalendarDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [status, setStatus] = useState<CalendarStatus>({
    connected: false,
    enabled: false,
    calendarEmail: null,
  });

  useEffect(() => {
    if (open && agentId) {
      loadStatus();
    }
  }, [open, agentId]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar_connected');
    const message = urlParams.get('message');
    
    if (calendarConnected !== null) {
      if (calendarConnected === 'true') {
        toast({
          title: "Agenda conectada!",
          description: message || "Sua agenda Google foi conectada com sucesso.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao conectar agenda",
          description: message || "Não foi possível conectar sua agenda.",
        });
      }
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth/status?agentId=${agentId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (error: any) {
      console.error("Erro ao carregar status do calendário:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar status",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Abrir popup de consent antes de redirecionar para Google
    setConsentAccepted(false);
    setShowConsent(true);
  };

  const handleConfirmConnect = async () => {
    if (!consentAccepted) return;
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId,
            redirectOrigin: window.location.origin,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start OAuth');
      }

      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Erro ao iniciar conexão:", error);
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: error.message,
      });
      setConnecting(false);
      setShowConsent(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth/disconnect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ agentId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast({
        title: "Agenda desconectada",
        description: "Sua agenda Google foi desconectada.",
      });

      setStatus({
        connected: false,
        enabled: false,
        calendarEmail: null,
      });
    } catch (error: any) {
      console.error("Erro ao desconectar:", error);
      toast({
        variant: "destructive",
        title: "Erro ao desconectar",
        description: error.message,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_calendar_settings")
        .upsert({
          agent_id: agentId,
          enabled,
        }, {
          onConflict: 'agent_id'
        });

      if (error) throw error;

      setStatus(prev => ({ ...prev, enabled }));
      
      toast({
        title: enabled ? "Agendamentos ativados" : "Agendamentos desativados",
        description: enabled 
          ? "A IA pode agora gerenciar agendamentos." 
          : "A IA não irá mais gerenciar agendamentos.",
      });
    } catch (error: any) {
      console.error("Erro ao atualizar configuração:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    }
  };

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
            {/* Connection Status */}
            {status.connected ? (
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Agenda Conectada
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {status.calendarEmail || "Google Calendar"}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 border rounded-lg bg-muted/50 border-border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Agenda não conectada</p>
                    <p className="text-sm text-muted-foreground">
                      Conecte sua conta Google para ativar agendamentos
                    </p>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Conectar Agenda Google
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Enable/Disable toggle - only show if connected */}
            {status.connected && (
              <div className="flex items-center justify-between pt-4 border-t">
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
                  checked={status.enabled}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Consent Dialog - Compliance Google */}
      <Dialog open={showConsent} onOpenChange={(open) => {
        if (!connecting) {
          setShowConsent(open);
          if (!open) setConsentAccepted(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Permissões solicitadas
            </DialogTitle>
            <DialogDescription>
              Antes de conectar sua agenda Google, leia atentamente quais permissões a IA terá:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* O que a IA PODE fazer */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">A IA poderá:</p>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Eye className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Ler eventos da agenda</span> para verificar disponibilidade de horários
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <CalendarPlus className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Criar, atualizar e remover eventos</span> referentes aos agendamentos feitos pelos seus clientes via conversa (necessário para remarcar ou cancelar quando o cliente pedir)
                </p>
              </div>
            </div>

            {/* O que a IA NÃO pode fazer */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">A IA NÃO poderá:</p>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <Ban className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Acessar <span className="font-medium text-foreground">outros dados da sua conta Google</span> (e-mails, contatos, Drive, fotos, etc.)
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <Ban className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Criar, excluir ou alterar configurações de calendários</span> (a permissão é restrita a eventos, não à estrutura da sua agenda)
                </p>
              </div>
            </div>

            {/* Aviso de revogação */}
            <p className="text-xs text-muted-foreground italic">
              Você pode revogar este acesso a qualquer momento clicando em "Desconectar" nesta tela ou diretamente em sua{" "}
              <a 
                href="https://myaccount.google.com/permissions" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                conta Google
              </a>.
            </p>

            {/* Checkbox de consentimento */}
            <div className="flex items-start gap-2 pt-2 border-t">
              <Checkbox
                id="consent-checkbox"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                disabled={connecting}
              />
              <Label
                htmlFor="consent-checkbox"
                className="text-sm leading-tight cursor-pointer"
              >
                Eu li e autorizo a IA a ler e criar eventos na minha agenda Google conforme descrito acima.
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowConsent(false)}
              disabled={connecting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmConnect}
              disabled={!consentAccepted || connecting}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecionando...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Continuar e conectar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
