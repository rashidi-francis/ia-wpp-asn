import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import InputMask from "react-input-mask";
import logo from "@/assets/chatasn-logo.png";

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }),
  celular: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, { message: "Celular inválido. Use o formato (XX) XXXXX-XXXX" }),
});

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Erro de validação",
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              variant: "destructive",
              title: "Erro ao fazer login",
              description: "Email ou senha incorretos.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Erro ao fazer login",
              description: error.message,
            });
          }
        } else if (data.session) {
          toast({
            title: "Login realizado!",
            description: "Bem-vindo de volta.",
          });
          navigate("/dashboard");
        }
      } else {
        const validation = signupSchema.safeParse({ email, password, nome, celular });
        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Erro de validação",
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              nome,
              celular,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: "Erro ao criar conta",
              description: "Este email já está cadastrado.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Erro ao criar conta",
              description: error.message,
            });
          }
        } else if (data.session) {
          toast({
            title: "Conta criada com sucesso!",
            description: "Redirecionando...",
          });
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background moderno com gradientes e waves */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0052CC] via-[#4C9AFF] to-white">
        {/* Wave shapes decorativas */}
        <svg className="absolute bottom-0 left-0 w-full h-64 opacity-20" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#ffffff" fillOpacity="0.8" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        <svg className="absolute top-0 right-0 w-full h-64 opacity-10" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#FF6B6B" fillOpacity="0.4" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,181.3C1248,181,1344,203,1392,213.3L1440,224L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
        </svg>
        {/* Círculos decorativos */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-32 right-20 w-96 h-96 bg-[#FF6B6B]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Seção de título e texto explicativo */}
            <div className="text-center lg:text-left space-y-8 animate-fade-in">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl leading-tight">
                  Bem-vindo ao <span className="text-[#FFC300]">ChatASN</span>
                </h1>
                <h3 className="text-xl lg:text-2xl text-white/95 font-medium drop-shadow-lg">
                  Inteligência Artificial para Atendimento WhatsApp 24h por dia.
                </h3>
              </div>

              {/* Texto com seta */}
              <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-4 mt-8">
                <p className="text-lg text-white font-semibold drop-shadow-md text-center lg:text-left">
                  Faça login ou cadastre-se para iniciar
                </p>
                {/* Seta horizontal para desktop */}
                <svg 
                  className="hidden lg:block w-20 h-20 text-[#FFC300] drop-shadow-glow animate-bounce-slow" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255, 195, 0, 0.6))' }}
                >
                  <path d="M13.025 1l-2.847 2.828 6.176 6.176h-16.354v3.992h16.354l-6.176 6.176 2.847 2.828 10.975-11z"/>
                </svg>
                {/* Seta curva para baixo em mobile */}
                <svg 
                  className="block lg:hidden w-16 h-16 text-[#FFC300] drop-shadow-glow animate-bounce-slow" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255, 195, 0, 0.6))' }}
                >
                  <path d="M12 3v13.586l-4.293-4.293-1.414 1.414L12 19.414l5.707-5.707-1.414-1.414L12 16.586V3z"/>
                </svg>
              </div>
            </div>

            {/* Card de login */}
            <div className="animate-fade-in-scale">
              <Card className="w-full max-w-md mx-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-none rounded-[22px] backdrop-blur-sm bg-white/90 hover:shadow-[0_25px_70px_rgba(0,0,0,0.35)] transition-all duration-500">
                <CardHeader className="space-y-4 text-center pb-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-glow-pulse"></div>
                      <img 
                        src={logo} 
                        alt="ChatASN" 
                        className="w-24 h-24 relative z-10 drop-shadow-2xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_100%]">
                      ChatASN
                    </CardTitle>
                    <p className="text-sm font-medium text-muted-foreground">
                      Inteligência Artificial para Seu Negócio
                    </p>
                  </div>
                  <CardDescription className="text-base">
                    {isLogin ? "Entre na sua conta" : "Crie sua conta gratuitamente"}
                  </CardDescription>
                </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="celular">Celular (WhatsApp)</Label>
                    <InputMask
                      mask="(99) 99999-9999"
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      disabled={loading}
                    >
                      {(inputProps: any) => (
                        <Input
                          {...inputProps}
                          id="celular"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          required
                        />
                      )}
                    </InputMask>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full shadow-lg hover:shadow-glow transition-all duration-300" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                disabled={loading}
              >
                {isLogin ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
              </button>
            </div>
          </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;