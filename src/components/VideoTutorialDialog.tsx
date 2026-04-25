import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VideoTutorialDialog = ({ open, onOpenChange }: VideoTutorialDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsLoading(true);
      setIsPlaying(false);
    }
    onOpenChange(newOpen);
  };

  const sendCommand = (func: "playVideo" | "pauseVideo") => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  };

  const togglePlay = () => {
    if (isPlaying) {
      sendCommand("pauseVideo");
      setIsPlaying(false);
    } else {
      sendCommand("playVideo");
      setIsPlaying(true);
    }
  };

  // Listener para detectar mudanças de estado do player
  useEffect(() => {
    if (!open) return;
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "infoDelivery" && data.info?.playerState !== undefined) {
          // 1 = playing, 2 = paused, 0 = ended
          if (data.info.playerState === 1) setIsPlaying(true);
          else if (data.info.playerState === 2 || data.info.playerState === 0) setIsPlaying(false);
        }
      } catch {
        // ignora
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] p-4 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            🎬 Vídeo Tutorial da Plataforma
          </DialogTitle>
        </DialogHeader>
        <div className="relative w-full flex-1 bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: "75vh" }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-30">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Carregando vídeo...</span>
              </div>
            </div>
          )}

          {/* Container do iframe escalado para esconder bordas com branding do YouTube */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <iframe
              ref={iframeRef}
              src="https://www.youtube-nocookie.com/embed/7qQPqLCK5HM?enablejsapi=1&modestbranding=1&rel=0&showinfo=0&controls=0&fs=0&playsinline=1&iv_load_policy=3&disablekb=1&autohide=1"
              title="Vídeo Tutorial"
              className="absolute"
              style={{
                top: "-10%",
                left: "-10%",
                width: "120%",
                height: "120%",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={false}
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {/* Overlay de clique para play/pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 z-10 flex items-center justify-center group focus:outline-none"
            aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
          >
            {!isPlaying && (
              <div className="w-20 h-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 animate-glow-pulse">
                <Play className="h-10 w-10 text-primary-foreground fill-primary-foreground ml-1" />
              </div>
            )}
          </button>

          {/* Controle de pausa discreto no canto (visível apenas quando tocando) */}
          {isPlaying && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={togglePlay}
              className="absolute bottom-3 left-3 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
              aria-label="Pausar vídeo"
            >
              <Pause className="h-5 w-5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
