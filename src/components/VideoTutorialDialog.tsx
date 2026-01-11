import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VideoTutorialDialog = ({ open, onOpenChange }: VideoTutorialDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            🎬 Vídeo Tutorial da Plataforma
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full min-h-[60vh]">
          <iframe
            src="https://drive.google.com/file/d/1dpwg1bA-Jp58E5MTcZaW9MO6I0vPl_v2/preview"
            className="w-full h-full rounded-lg"
            style={{ minHeight: "60vh" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
