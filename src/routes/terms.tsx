import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — WK Technology CRM" },
      {
        name: "description",
        content:
          "Leia os Termos de Serviço do WK Technology CRM: regras de uso da plataforma, responsabilidades, limites e condições da sua assinatura.",
      },
      { property: "og:title", content: "Termos de Serviço — WK Technology CRM" },
      {
        property: "og:description",
        content:
          "Leia os Termos de Serviço do WK Technology CRM: regras de uso da plataforma, responsabilidades, limites e condições da sua assinatura.",
      },
      { property: "og:url", content: "https://crm.wktechnology.com.br/terms" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Voltar
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Termos de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-semibold">1. Aceitação dos termos</h2>
          <p>
            Ao acessar e utilizar o WK Technology CRM, você concorda com estes Termos de Serviço e
            com a nossa Política de Privacidade. Se não concordar, não utilize o serviço.
          </p>

          <h2 className="text-lg font-semibold">2. Uso do serviço</h2>
          <p>
            Você se compromete a utilizar a plataforma apenas para finalidades lícitas, respeitando
            a legislação aplicável e os direitos de terceiros. O acesso é concedido por convite
            emitido por um administrador do workspace.
          </p>

          <h2 className="text-lg font-semibold">3. Conta e segurança</h2>
          <p>
            Você é responsável por manter a confidencialidade das credenciais de acesso e por todas
            as atividades realizadas em sua conta. Recomendamos ativar a autenticação em dois
            fatores (2FA).
          </p>

          <h2 className="text-lg font-semibold">4. Conteúdo do usuário</h2>
          <p>
            Você mantém a titularidade dos dados que insere no CRM. Concede-nos apenas a licença
            necessária para armazenar, processar e exibir esses dados com o objetivo de prestar o
            serviço.
          </p>

          <h2 className="text-lg font-semibold">5. Integrações de terceiros</h2>
          <p>
            Integrações como Google Calendar, Gmail, WhatsApp e Twilio estão sujeitas aos
            respectivos termos dos provedores. Não nos responsabilizamos por indisponibilidade ou
            alterações nesses serviços.
          </p>

          <h2 className="text-lg font-semibold">6. Limitação de responsabilidade</h2>
          <p>
            O serviço é fornecido "no estado em que se encontra". Na máxima extensão permitida em
            lei, não seremos responsáveis por danos indiretos, lucros cessantes ou perda de dados
            decorrentes do uso ou da impossibilidade de uso da plataforma.
          </p>

          <h2 className="text-lg font-semibold">7. Encerramento</h2>
          <p>
            Podemos suspender ou encerrar o acesso em caso de violação destes termos. Você pode
            encerrar sua conta a qualquer momento solicitando ao administrador do workspace.
          </p>

          <h2 className="text-lg font-semibold">8. Alterações</h2>
          <p>
            Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão comunicadas
            por e-mail ou aviso na plataforma.
          </p>

          <h2 className="text-lg font-semibold">9. Contato</h2>
          <p>
            Dúvidas sobre estes termos:{" "}
            <a href="mailto:contato@wktechnology.com.br" className="text-primary hover:underline">
              contato@wktechnology.com.br
            </a>
            .
          </p>
        </section>

        <div className="pt-4 border-t">
          <Link to="/privacy" className="text-sm text-primary hover:underline">
            Ver Política de Privacidade →
          </Link>
        </div>
      </div>
    </div>
  );
}
