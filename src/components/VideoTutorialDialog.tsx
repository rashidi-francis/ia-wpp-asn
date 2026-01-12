import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface VideoTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VideoTutorialDialog = ({ open, onOpenChange }: VideoTutorialDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsLoading(true); // Reset loading state when closing
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] p-4 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            🎬 Vídeo Tutorial da Plataforma
          </DialogTitle>
        </DialogHeader>
        <div className="relative w-full flex-1" style={{ aspectRatio: "9/16", maxHeight: "75vh" }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Carregando vídeo...</span>
              </div>
            </div>
          )}
          <iframe
            src="https://drive.google.com/file/d/1dpwg1bA-Jp58E5MTcZaW9MO6I0vPl_v2/preview"
            className="w-full h-full rounded-lg"
            allow="autoplay; encrypted-media"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
