import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

interface MetaApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

interface MetaInstance {
  id: string;
  status: string;
  phone_number: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  waba_id: string;
  phone_number_id: string;
  error_message: string | null;
}

const MetaApiDialog = ({ open, onOpenChange, agentId, agentName }: MetaApiDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [instance, setInstance] = useState<MetaInstance | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [formData, setFormData] = useState({
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
  });

  // Fetch current connection status when dialog opens
  useEffect(() => {
    if (open && agentId) {
      checkConnectionStatus();
    }
  }, [open, agentId]);

  const checkConnectionStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('meta-whatsapp-api', {
        body: {
          action: 'get_status',
          agentId,
        },
      });

      if (response.error) {
        console.error('Error checking META status:', response.error);
        return;
      }

      if (response.data?.connected) {
        setInstance({
          id: 'connected',
          status: response.data.status,
          phone_number: response.data.data.phoneNumber,
          display_phone_number: response.data.data.displayPhoneNumber,
          verified_name: response.data.data.verifiedName,
          waba_id: response.data.data.wabaId,
          phone_number_id: response.data.data.phoneNumberId,
          error_message: response.data.error || null,
        });
      } else if (response.data?.status === 'error') {
        setInstance({
          id: 'error',
          status: 'error',
          phone_number: null,
          display_phone_number: response.data.data?.displayPhoneNumber || null,
          verified_name: response.data.data?.verifiedName || null,
          waba_id: '',
          phone_number_id: '',
          error_message: response.data.error || 'Erro de conexão',
        });
      } else {
        setInstance(null);
      }
    } catch (error) {
      console.error('Error checking META connection:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!formData.wabaId || !formData.phoneNumberId || !formData.accessToken) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('meta-whatsapp-api', {
        body: {
          action: 'connect',
          agentId,
          credentials: {
            wabaId: formData.wabaId.trim(),
            phoneNumberId: formData.phoneNumberId.trim(),
            accessToken: formData.accessToken.trim(),
            businessAccountId: formData.businessAccountId.trim() || undefined,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        toast({
          title: "Erro na conexão",
          description: response.data?.error || "Não foi possível conectar. Verifique suas credenciais.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conectado com sucesso!",
        description: `WhatsApp ${response.data.data.displayPhoneNumber} conectado via API Oficial da META.`,
      });

      // Clear form and refresh status
      setFormData({ wabaId: "", phoneNumberId: "", accessToken: "", businessAccountId: "" });
      await checkConnectionStatus();
    } catch (error) {
      console.error("Error connecting META API:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao conectar com a API da META.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('meta-whatsapp-api', {
        body: {
          action: 'disconnect',
          agentId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        toast({
          title: "Erro",
          description: response.data?.error || "Erro ao desconectar.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Desconectado",
        description: "Conexão com a API da META foi removida.",
      });

      setInstance(null);
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Error disconnecting META API:", error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar da API da META.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!instance) return null;

    switch (instance.status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Conectando
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.2A1.5 1.5 0 003.8 21.454l3.032-.892A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#25D366"/>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="white"/>
              </svg>
              Login API Oficial da META
            </DialogTitle>
            <DialogDescription>
              Configure sua conexão direta com a API Oficial do WhatsApp Business da META para o agente <strong>{agentName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {checkingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Verificando conexão...</span>
            </div>
          ) : instance?.status === 'connected' ? (
            // Connected state
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusBadge()}
                  </div>
                  <p className="text-sm font-medium">{instance.display_phone_number}</p>
                  {instance.verified_name && (
                    <p className="text-xs text-muted-foreground">{instance.verified_name}</p>
                  )}
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WABA ID:</span>
                  <span className="font-mono text-xs">{instance.waba_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Number ID:</span>
                  <span className="font-mono text-xs">{instance.phone_number_id}</span>
                </div>
              </div>

              <div className="bg-blue-500/10 p-3 rounded-lg text-sm text-blue-300 border border-blue-500/20">
                <p className="font-medium mb-1">✨ Vantagens da API Oficial:</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-blue-200">
                  <li>Sem limite de interações</li>
                  <li>Conexão estável e oficial</li>
                  <li>Suporte a templates de mensagens</li>
                  <li>Webhooks em tempo real</li>
                </ul>
              </div>
            </div>
          ) : instance?.status === 'error' ? (
            // Error state
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusBadge()}
                  </div>
                  <p className="text-sm text-red-300">{instance.error_message}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>

              <p className="text-sm text-muted-foreground">
                Houve um erro com suas credenciais. Por favor, reconecte com credenciais válidas.
              </p>

              {/* Show form to reconnect */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="wabaId">WABA ID (WhatsApp Business Account ID) *</Label>
                  <Input
                    id="wabaId"
                    placeholder="Ex: 123456789012345"
                    value={formData.wabaId}
                    onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="Ex: 123456789012345"
                    value={formData.phoneNumberId}
                    onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token *</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="Token de acesso permanente"
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            // Not connected - show form
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="wabaId">WABA ID (WhatsApp Business Account ID) *</Label>
                <Input
                  id="wabaId"
                  placeholder="Ex: 123456789012345"
                  value={formData.wabaId}
                  onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="Ex: 123456789012345"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Token de acesso permanente"
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAccountId">Business Account ID (opcional)</Label>
                <Input
                  id="businessAccountId"
                  placeholder="Ex: 123456789012345"
                  value={formData.businessAccountId}
                  onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                <p className="font-medium mb-1">Como obter essas credenciais:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Acesse <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.facebook.com</a></li>
                  <li>Crie ou selecione seu aplicativo</li>
                  <li>Vá em WhatsApp &gt; Configuração da API</li>
                  <li>Copie o WABA ID, Phone Number ID e gere um token permanente</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {instance?.status === 'connected' ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDisconnectDialog(true)}
                  disabled={loading}
                >
                  <Unplug className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConnect} 
                  disabled={loading || checkingStatus} 
                  className="bg-[#25D366] hover:bg-[#20bd5a]"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Conectar API META
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar API META?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar a API Oficial da META? 
              O agente não poderá mais receber ou enviar mensagens via WhatsApp até uma nova conexão ser configurada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sim, desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MetaApiDialog;
