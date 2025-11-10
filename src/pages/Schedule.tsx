import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Session } from "@supabase/supabase-js";

const Schedule = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">AI</span>
          </div>
          <h1 className="text-xl font-bold">Agendar Conexão WhatsApp</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Agendar Conexão WhatsApp na IA</CardTitle>
            <CardDescription className="text-base">
              Agende uma reunião com nosso time para conectar o seu WhatsApp à IA da Ajudo Seu Negócio.
              Durante a reunião, enviaremos o QR Code de conexão do seu número.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold mb-2">O que você precisa para a reunião:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Seu celular com WhatsApp instalado</li>
                <li>Acesso ao número que deseja conectar</li>
                <li>Cerca de 15 minutos disponíveis</li>
              </ul>
            </div>

            <div className="rounded-lg overflow-hidden border shadow-sm">
              <iframe
                src="https://calendly.com/seu-calendly"
                width="100%"
                height="700"
                frameBorder="0"
                title="Agendar Reunião"
                className="bg-background"
              />
            </div>

            <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
              <p className="text-sm text-center">
                <strong>Precisa de ajuda?</strong> Nossa equipe está disponível no WhatsApp
                para responder suas dúvidas. Clique no botão no canto inferior direito.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <WhatsAppButton />
    </div>
  );
};

export default Schedule;