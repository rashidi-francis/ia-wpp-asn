import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface AdminSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export const AdminSuccessDialog = ({
  open,
  onOpenChange,
  title,
  description,
}: AdminSuccessDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          
          <h2 className="text-xl font-bold text-green-600">{title}</h2>
          
          <p className="text-muted-foreground text-sm">{description}</p>
          
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full bg-green-500 hover:bg-green-600 text-white mt-2"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
