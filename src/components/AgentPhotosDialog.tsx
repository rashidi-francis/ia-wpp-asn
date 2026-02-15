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
import { Loader2, Image, FileText, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AgentPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface AgentFile {
  id: string;
  agent_id: string;
  url: string;
  description: string | null;
  file_type: string;
  created_at: string;
}

export function AgentPhotosDialog({ open, onOpenChange, agentId }: AgentPhotosDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"image" | "pdf">("image");

  useEffect(() => {
    if (open && agentId) {
      loadFiles();
    }
  }, [open, agentId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_photos")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles((data as AgentFile[]) || []);
    } catch (error: any) {
      console.error("Erro ao carregar arquivos:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar arquivos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFile = async () => {
    if (!newUrl.trim()) {
      toast({
        variant: "destructive",
        title: "URL obrigatória",
        description: "Por favor, insira a URL do arquivo.",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("agent_photos")
        .insert({
          agent_id: agentId,
          url: newUrl.trim(),
          description: newDescription.trim() || null,
          file_type: activeTab,
        })
        .select()
        .single();

      if (error) throw error;

      setFiles([data as AgentFile, ...files]);
      setNewUrl("");
      setNewDescription("");

      toast({
        title: activeTab === "image" ? "Foto adicionada" : "PDF adicionado",
        description: "O arquivo foi adicionado com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao adicionar arquivo:", error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from("agent_photos")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      setFiles(files.filter((f) => f.id !== fileId));

      toast({
        title: "Arquivo removido",
        description: "O arquivo foi removido com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao remover arquivo:", error);
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message,
      });
    }
  };

  const photos = files.filter((f) => f.file_type === "image" || !f.file_type);
  const pdfs = files.filter((f) => f.file_type === "pdf");

  const renderFileList = (fileList: AgentFile[], type: "image" | "pdf") => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (fileList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {type === "image" ? (
            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
          ) : (
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          )}
          <p>Nenhum {type === "image" ? "foto" : "PDF"} adicionado ainda.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          {type === "image" ? "Fotos" : "PDFs"} ({fileList.length})
        </Label>
        <div className="grid gap-3">
          {fileList.map((file) => (
            <div
              key={file.id}
              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {type === "image" ? (
                  <img
                    src={file.url}
                    alt={file.description || "Foto do agente"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <FileText className="h-8 w-8 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.url}</p>
                {file.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {file.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Adicionado em {new Date(file.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteFile(file.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Fotos e PDFs do Agente
          </DialogTitle>
          <DialogDescription>
            Adicione fotos ou PDFs que a IA pode enviar durante as conversas (ex: catálogos, formulários, fotos de produtos).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "image" | "pdf")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Fotos ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDFs ({pdfs.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Add new file form */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-semibold">
                Adicionar {activeTab === "image" ? "nova foto" : "novo PDF"}
              </Label>
              <div className="space-y-2">
                <Input
                  placeholder={activeTab === "image" 
                    ? "URL da foto (ex: https://exemplo.com/foto.jpg)" 
                    : "URL do PDF (ex: https://exemplo.com/formulario.pdf)"
                  }
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
                <Input
                  placeholder={activeTab === "image"
                    ? "Descrição (quando a IA deve enviar esta foto?)"
                    : "Descrição (quando a IA deve enviar este PDF?)"
                  }
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
                <Button
                  onClick={handleAddFile}
                  disabled={saving || !newUrl.trim()}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Adicionar {activeTab === "image" ? "Foto" : "PDF"}
                </Button>
              </div>
            </div>

            <TabsContent value="image" className="mt-0">
              {renderFileList(photos, "image")}
            </TabsContent>
            <TabsContent value="pdf" className="mt-0">
              {renderFileList(pdfs, "pdf")}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
