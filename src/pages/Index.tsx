import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    };
    
    checkSession();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/5 animate-gradient-shift bg-[length:200%_200%]">
      <div className="flex flex-col items-center gap-4 animate-fade-in-scale">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-glow-pulse">
          <span className="text-2xl font-bold text-primary-foreground">AI</span>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  );
};

export default Index;
