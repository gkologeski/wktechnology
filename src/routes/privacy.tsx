import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — WK Technology CRM" },
      { name: "description", content: "Saiba como o WK Technology CRM coleta, usa, compartilha e protege seus dados pessoais e os dados de clientes, leads e integrações." },
      { property: "og:title", content: "Política de Privacidade — WK Technology CRM" },
      { property: "og:description", content: "Saiba como o WK Technology CRM coleta, usa, compartilha e protege seus dados pessoais e os dados de clientes, leads e integrações." },
      { property: "og:url", content: "https://crm.wktechnology.com.br/privacy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/" className="text-sm text-primary hover:underline">← Voltar</Link>
          <h1 className="mt-2 text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-semibold">1. Informações que coletamos</h2>
          <p>
            Coletamos informações que você nos fornece diretamente ao criar sua conta, como nome, e-mail e
            dados relacionados aos seus contatos, leads, empresas, negócios e atividades registradas no CRM.
          </p>

          <h2 className="text-lg font-semibold">2. Uso das informações</h2>
          <p>
            Utilizamos os dados para fornecer e melhorar nossos serviços, autenticar usuários, sincronizar
            integrações autorizadas (como Google Calendar e Gmail) e oferecer suporte.
          </p>

          <h2 className="text-lg font-semibold">3. Compartilhamento</h2>
          <p>
            Não vendemos seus dados. Compartilhamos informações apenas com provedores essenciais para a
            operação do serviço (hospedagem, autenticação, e-mail) e quando exigido por lei.
          </p>

          <h2 className="text-lg font-semibold">4. Integrações com Google</h2>
          <p>
            Quando você conecta sua conta Google, acessamos apenas os escopos autorizados (Calendar, Gmail)
            para executar as funcionalidades solicitadas. Você pode revogar o acesso a qualquer momento em
            sua conta Google ou nas configurações do CRM.
          </p>

          <h2 className="text-lg font-semibold">5. Segurança</h2>
          <p>
            Aplicamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia em
            trânsito, controle de acesso por workspace e políticas de segurança em nível de linha (RLS).
          </p>

          <h2 className="text-lg font-semibold">6. Seus direitos (LGPD)</h2>
          <p>
            Você pode acessar, corrigir, exportar ou excluir seus dados pessoais a qualquer momento.
            Usuários autenticados podem fazer isso diretamente em{" "}
            <Link to="/settings/privacy" className="text-primary hover:underline">
              Configurações → Privacidade & Meus Dados
            </Link>
            , ou solicitando ao administrador do seu workspace.
          </p>

          <h2 className="text-lg font-semibold">7. Contato</h2>
          <p>
            Em caso de dúvidas sobre esta política, entre em contato pelo e-mail{" "}
            <a href="mailto:contato@wktechnology.com.br" className="text-primary hover:underline">
              contato@wktechnology.com.br
            </a>.
          </p>
        </section>

        <div className="pt-4 border-t">
          <Link to="/terms" className="text-sm text-primary hover:underline">Ver Termos de Serviço →</Link>
        </div>
      </div>
    </div>
  );
}
