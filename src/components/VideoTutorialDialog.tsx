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
            <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg z-30">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Carregando vídeo...</span>
              </div>
            </div>
          )}
          <iframe
            src="https://www.youtube-nocookie.com/embed/7qQPqLCK5HM?modestbranding=1&rel=0&showinfo=0&controls=1&fs=0&playsinline=1&iv_load_policy=3&disablekb=1"
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            onLoad={() => setIsLoading(false)}
          />
          {/* Bloqueia o título do YouTube no topo (clicável quando pausado) */}
          <div
            className="absolute top-0 left-0 right-0 h-14 bg-background z-20 rounded-t-lg pointer-events-auto"
            aria-hidden="true"
          />
          {/* Bloqueia o botão "Watch on YouTube" no canto inferior direito */}
          <div
            className="absolute bottom-12 right-0 h-12 w-40 z-20 pointer-events-auto"
            aria-hidden="true"
          />
          {/* Bloqueia o logo do YouTube no canto inferior direito da barra de controles */}
          <div
            className="absolute bottom-0 right-0 h-10 w-20 z-20 pointer-events-auto"
            aria-hidden="true"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
