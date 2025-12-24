import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface SupportFAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const faqItems = [
  {
    question: "Como criar um novo agente?",
    answer: "Na tela principal do Dashboard, clique no botão 'Criar Novo Agente'. Você será direcionado para a página de configuração onde poderá definir o nome, personalidade e instruções do seu agente de IA."
  },
  {
    question: "Como conectar meu WhatsApp ao agente?",
    answer: "Acesse o agente desejado e vá até a seção 'Conexão WhatsApp'. Clique em 'Conectar WhatsApp' e escaneie o QR Code que aparecerá na tela usando o aplicativo WhatsApp do seu celular. Vá em 'Configurações > Aparelhos conectados > Conectar aparelho'."
  },
  {
    question: "Como editar as instruções do meu agente?",
    answer: "Clique no card do agente que deseja editar no Dashboard. Na página do agente, você encontrará campos para configurar: quem é o agente, o que ele faz, objetivo, como deve responder, tópicos a evitar, links permitidos e regras personalizadas."
  },
  {
    question: "Como acessar as conversas do meu agente?",
    answer: "No card do agente, clique no ícone de balão de mensagem (💬) ou acesse a página do agente e clique em 'Ver Conversas'. Lá você poderá visualizar todas as conversas realizadas pelo seu agente no WhatsApp."
  },
  {
    question: "Como alterar meu plano?",
    answer: "Clique em 'Minha Conta' no canto superior direito e selecione 'Meu Plano'. Você verá as opções de planos disponíveis com os recursos de cada um. Escolha o plano desejado e siga as instruções para pagamento."
  },
  {
    question: "Como adicionar membros à minha equipe?",
    answer: "Acesse 'Minha Conta' > 'Equipes'. Clique em 'Convidar Membro' e insira o email da pessoa que deseja adicionar. Ela receberá um convite por email para acessar a plataforma."
  },
  {
    question: "Como desconectar o WhatsApp do agente?",
    answer: "Acesse a página do agente e vá até a seção 'Conexão WhatsApp'. Clique no botão 'Desconectar' para remover a conexão. Você precisará escanear o QR Code novamente para reconectar."
  },
  {
    question: "O que fazer se o agente não está respondendo?",
    answer: "Verifique se: 1) O WhatsApp está conectado (status verde), 2) O agente está ativo, 3) As instruções do agente estão configuradas corretamente. Se o problema persistir, tente desconectar e reconectar o WhatsApp."
  },
  {
    question: "Como excluir um agente?",
    answer: "No Dashboard, clique no ícone de engrenagem (⚙️) no card do agente e selecione 'Eliminar Agente'. Confirme a exclusão nas duas etapas de confirmação. Atenção: essa ação é irreversível."
  },
  {
    question: "Quantos agentes posso criar?",
    answer: "A quantidade de agentes depende do seu plano: Básico permite 1 agente, Avançado permite até 3 agentes, e o plano Empresarial permite até 10 agentes."
  }
];

export function SupportFAQDialog({ open, onOpenChange }: SupportFAQDialogProps) {
  const handleWhatsAppSupport = () => {
    const message = encodeURIComponent("Olá, sou usuário da plataforma: chat.ajudoseunegocio.com , preciso de suporte...");
    window.open(`https://api.whatsapp.com/send/?phone=5511930500397&text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Central de Ajuda
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <p className="text-muted-foreground mb-6">
            Encontre respostas para as perguntas mais frequentes sobre a plataforma.
          </p>

          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border border-primary/20 rounded-lg px-4 data-[state=open]:bg-primary/5"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-8 p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl text-center">
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-4">
              Não encontrou o que precisava?
            </p>
            <p className="text-muted-foreground mb-4">
              Nossa equipe está pronta para te ajudar!
            </p>
            <Button 
              onClick={handleWhatsAppSupport}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Chamar Suporte no WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
