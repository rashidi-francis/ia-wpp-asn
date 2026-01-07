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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image, Plus, Trash2, X } from "lucide-react";

interface AgentPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface AgentPhoto {
  id: string;
  agent_id: string;
  url: string;
  description: string | null;
  created_at: string;
}

export function AgentPhotosDialog({ open, onOpenChange, agentId }: AgentPhotosDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<AgentPhoto[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoDescription, setNewPhotoDescription] = useState("");

  useEffect(() => {
    if (open && agentId) {
      loadPhotos();
    }
  }, [open, agentId]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_photos")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar fotos:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar fotos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!newPhotoUrl.trim()) {
      toast({
        variant: "destructive",
        title: "URL obrigatória",
        description: "Por favor, insira a URL da foto.",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("agent_photos")
        .insert({
          agent_id: agentId,
          url: newPhotoUrl.trim(),
          description: newPhotoDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setPhotos([data, ...photos]);
      setNewPhotoUrl("");
      setNewPhotoDescription("");

      toast({
        title: "Foto adicionada",
        description: "A foto foi adicionada com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao adicionar foto:", error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar foto",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from("agent_photos")
        .delete()
        .eq("id", photoId);

      if (error) throw error;

      setPhotos(photos.filter((p) => p.id !== photoId));

      toast({
        title: "Foto removida",
        description: "A foto foi removida com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao remover foto:", error);
      toast({
        variant: "destructive",
        title: "Erro ao remover foto",
        description: error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Fotos do Agente
          </DialogTitle>
          <DialogDescription>
            Adicione fotos que a IA pode enviar durante as conversas (ex: fotos de produtos, quartos, etc).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Add new photo form */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base font-semibold">Adicionar nova foto</Label>
            <div className="space-y-2">
              <Input
                placeholder="URL da foto (ex: https://exemplo.com/foto.jpg)"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
              />
              <Input
                placeholder="Descrição (quando a IA deve enviar esta foto?)"
                value={newPhotoDescription}
                onChange={(e) => setNewPhotoDescription(e.target.value)}
              />
              <Button
                onClick={handleAddPhoto}
                disabled={saving || !newPhotoUrl.trim()}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Adicionar Foto
              </Button>
            </div>
          </div>

          {/* Photo list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma foto adicionada ainda.</p>
              <p className="text-sm">Adicione fotos que a IA pode usar nas conversas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Fotos adicionadas ({photos.length})</Label>
              <div className="grid gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={photo.url}
                        alt={photo.description || "Foto do agente"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{photo.url}</p>
                      {photo.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Adicionada em {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
