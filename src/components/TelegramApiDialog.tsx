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
import { Loader2, CheckCircle2, Unplug, Send } from "lucide-react";
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

interface TelegramApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

interface TelegramInstance {
  id: string;
  status: string;
  bot_username: string | null;
  bot_name: string | null;
  error_message: string | null;
}

const TelegramApiDialog = ({ open, onOpenChange, agentId, agentName }: TelegramApiDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [instance, setInstance] = useState<TelegramInstance | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [botToken, setBotToken] = useState("");

  useEffect(() => {
    if (open && agentId) checkConnectionStatus();
  }, [open, agentId]);

  const checkConnectionStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-connect', {
        body: { action: 'get_status', agentId },
      });
      if (error) throw error;
      setInstance((data?.instance as TelegramInstance) || null);
    } catch (e) {
      console.error('Error checking Telegram status:', e);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!botToken.trim()) {
      toast({ title: "Token obrigatório", description: "Cole o token do bot do @BotFather.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-connect', {
        body: { action: 'connect', agentId, botToken: botToken.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Telegram conectado!",
        description: data?.bot_username ? `Bot @${data.bot_username} ativo.` : "Bot ativo.",
      });
      setBotToken("");
      await checkConnectionStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ title: "Erro ao conectar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('telegram-connect', {
        body: { action: 'disconnect', agentId },
      });
      if (error) throw error;
      toast({ title: "Desconectado", description: "O bot do Telegram foi removido." });
      setInstance(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ title: "Erro ao desconectar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      setShowDisconnectDialog(false);
    }
  };

  const isConnected = instance?.status === 'connected';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#229ED9]" />
              Telegram Bot IA — {agentName}
            </DialogTitle>
            <DialogDescription>
              Conecte um bot do Telegram a este agente. As mensagens caem no mesmo motor de IA, agenda e follow-up.
            </DialogDescription>
          </DialogHeader>

          {checkingStatus ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : isConnected ? (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Bot conectado</p>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>
                  </div>
                  {instance?.bot_username && (
                    <p className="text-sm text-muted-foreground">@{instance.bot_username}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Seu agente já responde no Telegram. Compartilhe o link{" "}
                {instance?.bot_username ? (
                  <span className="text-primary">t.me/{instance.bot_username}</span>
                ) : "do seu bot"}{" "}
                com seus clientes.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={loading}
              >
                <Unplug className="w-4 h-4 mr-2" />
                Desconectar bot
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegram-token">Token do Bot (BotFather)</Label>
                <Input
                  id="telegram-token"
                  placeholder="123456789:ABCdef..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  No Telegram, fale com <span className="text-primary">@BotFather</span> → /newbot → copie o token e cole aqui.
                </p>
              </div>
              {instance?.status === 'error' && instance?.error_message && (
                <p className="text-xs text-destructive">{instance.error_message}</p>
              )}
            </div>
          )}

          {!isConnected && !checkingStatus && (
            <DialogFooter>
              <Button onClick={handleConnect} disabled={loading} className="bg-[#229ED9] hover:bg-[#1c87b9] text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Conectar Telegram
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar bot do Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              O webhook será removido e o agente deixará de responder no Telegram. Você pode reconectar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TelegramApiDialog;
