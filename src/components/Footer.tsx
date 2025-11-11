export const Footer = () => {
  return (
    <footer className="w-full border-t border-border bg-background py-6 mt-auto">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm text-muted-foreground">
          Todos os Direitos Reservados IA Ajudo Seu Negócio © Desenvolvido por{" "}
          <a
            href="https://ajudoseunegocio.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline transition-colors"
          >
            ajudoseunegocio.com.br
          </a>
        </p>
      </div>
    </footer>
  );
};
