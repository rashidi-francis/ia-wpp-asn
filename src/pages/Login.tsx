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
import { LoginFooter } from "@/components/LoginFooter";
import InputMask from "react-input-mask";
import { Separator } from "@/components/ui/separator";
import { generateFingerprint } from "@/lib/fingerprint";

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
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    // Meta Pixel PageView event
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'PageView');
    }

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

        // Anti-fraud: Check fingerprint before allowing signup
        const fingerprint = generateFingerprint();
        try {
          const { data: fingerprintCheck, error: fpError } = await supabase.functions.invoke('check-fingerprint', {
            body: { fingerprint, action: 'check' }
          });

          if (fpError) {
            console.error('Fingerprint check error:', fpError);
          } else if (fingerprintCheck && !fingerprintCheck.can_create) {
            toast({
              variant: "destructive",
              title: "Limite atingido",
              description: "Para garantir uma utilização justa da plataforma, o período experimental é limitado a um número máximo de contas por dispositivo. Caso necessite de mais acessos, entre em contacto com o suporte.",
            });
            setLoading(false);
            return;
          }
        } catch (fpCheckError) {
          console.error('Error checking fingerprint:', fpCheckError);
          // Continue with signup even if fingerprint check fails
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
          // Register fingerprint for anti-fraud
          const fingerprint = generateFingerprint();
          try {
            await supabase.functions.invoke('check-fingerprint', {
              body: { fingerprint, action: 'register', userId: data.session.user.id }
            });
          } catch (fpRegisterError) {
            console.error('Error registering fingerprint:', fpRegisterError);
          }
          
          // Meta Pixel CompleteRegistration event (cadastro)
          if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'CompleteRegistration', {
              content_name: 'Cadastro ChatASN',
              status: 'success'
            });
          }
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao entrar com Google",
          description: error.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    } finally {
      setGoogleLoading(false);
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
                  Boas vindas ao <span className="text-[#FFC300]">ChatASN</span>
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
              <Button type="submit" className="w-full shadow-lg hover:shadow-glow transition-all duration-300" disabled={loading || googleLoading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            {/* Separator */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">ou continue com</span>
              </div>
            </div>

            {/* Google Login Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 py-5 border-2 hover:bg-muted/50 transition-all duration-300"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span className="font-medium">Continuar com Google</span>
            </Button>

            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                disabled={loading || googleLoading}
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
      <LoginFooter />
    </div>
  );
};

export default Login;