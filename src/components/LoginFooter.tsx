export const LoginFooter = () => {
  return (
    <footer className="w-full py-6 relative z-10">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm text-white/90">
          Ao se cadastrar em nosso app você concorda com nossa{" "}
          <a
            href="https://ajudoseunegocio.com.br/politica-de-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFC300] hover:underline transition-colors font-medium"
          >
            política de privacidade
          </a>{" "}
          e nossos{" "}
          <a
            href="https://ajudoseunegocio.com.br/termos-de-uso"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFC300] hover:underline transition-colors font-medium"
          >
            termos de uso
          </a>{" "}
          | Plataforma desenvolvida por:{" "}
          <a
            href="https://ajudoseunegocio.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFC300] hover:underline transition-colors font-medium"
          >
            ajudoseunegocio.com.br
          </a>
        </p>
      </div>
    </footer>
  );
};
