import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import logo from "@/assets/chatasn-logo.png";

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
      <div className="flex flex-col items-center gap-6 animate-fade-in-scale">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-glow-pulse"></div>
          <img 
            src={logo} 
            alt="ChatASN" 
            className="w-32 h-32 relative z-10 drop-shadow-2xl animate-float"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-shift">
            ChatASN
          </h1>
          <p className="text-sm text-muted-foreground">Inteligência Artificial para seu negócio</p>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary mt-2" />
      </div>
    </div>
  );
};

export default Index;
