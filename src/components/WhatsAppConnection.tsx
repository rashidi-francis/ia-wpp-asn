import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WhatsAppConnectionProps {
  agentId: string;
  agentName: string;
}

interface WhatsAppInstance {
  id: string;
  agent_id: string;
  instance_name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending';
  qr_code: string | null;
  qr_code_expires_at: string | null;
  phone_number: string | null;
}

const WhatsAppConnection = ({ agentId, agentName }: WhatsAppConnectionProps) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Sync agent to n8n when WhatsApp is connected
  const syncAgentToN8n = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      console.log('Syncing agent to n8n after WhatsApp connection...');
      const { data, error } = await supabase.functions.invoke('sync-agent-n8n', {
        body: { agentId },
      });

      if (error) {
        console.error('Error syncing to n8n:', error);
      } else {
        console.log('Agent synced to n8n successfully:', data);
      }
    } catch (error) {
      console.error('Error syncing agent to n8n:', error);
    }
  };

  useEffect(() => {
    fetchInstance();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`whatsapp_${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `agent_id=eq.${agentId}`,
        },
        async (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'DELETE') {
            setInstance(null);
            setQrCode(null);
          } else {
            const newData = payload.new as WhatsAppInstance;
            const oldData = payload.old as WhatsAppInstance | null;
            setInstance(newData);
            if (newData.qr_code) {
              setQrCode(newData.qr_code);
            }
            
            // When status changes to connected, sync agent to n8n with instance_name
            if (newData.status === 'connected' && oldData?.status !== 'connected') {
              console.log('WhatsApp connected! Triggering n8n sync...');
              await syncAgentToN8n();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  const fetchInstance = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setInstance(data as WhatsAppInstance);
        if (data.qr_code) {
          setQrCode(data.qr_code);
        }
      }
    } catch (error) {
      console.error('Error fetching instance:', error);
    } finally {
      setLoading(false);
    }
  };

  const callEvolutionApi = async (action: string) => {
    const { data, error } = await supabase.functions.invoke('evolution-api', {
      body: {
        action,
        agentId,
      },
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data;
  };

  const handleCreateInstance = async () => {
    setActionLoading(true);
    try {
      const result = await callEvolutionApi('create_instance');
      
      if (result.qrcode) {
        setQrCode(result.qrcode);
      }
      
      toast({
        title: "Instância criada!",
        description: "Escaneie o QR Code com seu WhatsApp.",
      });
      
      await fetchInstance();
    } catch (error: unknown) {
      console.error('Error creating instance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao criar instância",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGetQRCode = async () => {
    setActionLoading(true);
    try {
      const result = await callEvolutionApi('get_qrcode');
      
      if (result.qrcode) {
        setQrCode(result.qrcode);
        toast({
          title: "QR Code gerado!",
          description: "Escaneie o código com seu WhatsApp.",
        });
      } else if (result.message) {
        toast({
          title: "Aguarde...",
          description: result.message,
        });
        // Try again after a short delay
        setTimeout(async () => {
          const retryResult = await callEvolutionApi('get_qrcode');
          if (retryResult.qrcode) {
            setQrCode(retryResult.qrcode);
            toast({
              title: "QR Code gerado!",
              description: "Escaneie o código com seu WhatsApp.",
            });
          }
          await fetchInstance();
        }, 3000);
      }
      
      await fetchInstance();
    } catch (error: unknown) {
      console.error('Error getting QR code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao obter QR Code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setActionLoading(true);
    try {
      const result = await callEvolutionApi('get_status');
      
      toast({
        title: "Status atualizado",
        description: `Status: ${result.status}`,
      });
      
      await fetchInstance();
    } catch (error: unknown) {
      console.error('Error checking status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao verificar status",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await callEvolutionApi('disconnect');
      setQrCode(null);
      
      toast({
        title: "Desconectado",
        description: "WhatsApp foi desconectado.",
      });
      
      await fetchInstance();
    } catch (error: unknown) {
      console.error('Error disconnecting:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao desconectar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInstance = async () => {
    setActionLoading(true);
    try {
      await callEvolutionApi('delete_instance');
      setInstance(null);
      setQrCode(null);
      
      toast({
        title: "Instância removida",
        description: "A conexão WhatsApp foi removida.",
      });
    } catch (error: unknown) {
      console.error('Error deleting instance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao remover instância",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!instance) return null;
    
    switch (instance.status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Wifi className="w-3 h-3 mr-1" /> Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Conectando
          </Badge>
        );
      case 'qr_pending':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <QrCode className="w-3 h-3 mr-1" /> Aguardando QR Code
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <WifiOff className="w-3 h-3 mr-1" /> Desconectado
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="w-5 h-5 text-[#25D366]" />
              Conexão WhatsApp
            </CardTitle>
            <CardDescription>
              Conecte o WhatsApp para ativar o agente {agentName}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!instance ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <QrCode className="w-10 h-10 text-[#25D366]" />
            </div>
            <p className="text-muted-foreground mb-4">
              Nenhuma conexão WhatsApp configurada para este agente.
            </p>
            <Button 
              onClick={handleCreateInstance} 
              disabled={actionLoading}
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          </div>
        ) : instance.status === 'connected' ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <Wifi className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-green-400 font-medium mb-1">WhatsApp Conectado!</p>
            {instance.phone_number && (
              <p className="text-muted-foreground text-sm mb-4">
                Número: {instance.phone_number}
              </p>
            )}
            <p className="text-muted-foreground text-sm mb-4">
              Seu agente está pronto para receber mensagens.
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                onClick={handleCheckStatus}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Verificar Status
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDisconnect}
                disabled={actionLoading}
              >
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCode ? (
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img 
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Escaneie o QR Code com seu WhatsApp para conectar
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button 
                    variant="outline" 
                    onClick={handleGetQRCode}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Atualizar QR Code
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCheckStatus}
                    disabled={actionLoading}
                  >
                    Verificar Conexão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Button 
                  onClick={handleGetQRCode}
                  disabled={actionLoading}
                  className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  Gerar QR Code
                </Button>
              </div>
            )}
            
            <div className="pt-4 border-t border-border/50">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover conexão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover conexão WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá desconectar e remover completamente a conexão WhatsApp deste agente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteInstance}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnection;
