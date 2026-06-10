import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Política de Reembolso e Cancelamento — WK Technology CRM" },
      { name: "description", content: "Regras de reembolso, cancelamento e devolução proporcional para assinaturas do WK Technology CRM." },
      { property: "og:title", content: "Política de Reembolso e Cancelamento — WK Technology CRM" },
      { property: "og:description", content: "Regras de reembolso, cancelamento e devolução proporcional para assinaturas do WK Technology CRM." },
      { property: "og:url", content: "https://crm.wktechnology.com.br/refund" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/refund" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/" className="text-sm text-primary hover:underline">← Voltar</Link>
          <h1 className="mt-2 text-3xl font-bold">Política de Reembolso e Cancelamento</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-semibold">1. Período de teste e arrependimento</h2>
          <p>
            Em conformidade com o art. 49 do Código de Defesa do Consumidor, o cliente tem direito ao
            arrependimento no prazo de <strong>7 (sete) dias corridos</strong> após a contratação
            realizada fora do estabelecimento (incluindo contratações online), com reembolso integral
            do valor pago, sem necessidade de justificativa.
          </p>

          <h2 className="text-lg font-semibold">2. Cancelamento de assinaturas mensais</h2>
          <p>
            O cliente pode cancelar a assinatura mensal a qualquer momento em{" "}
            <Link to="/settings/billing" className="text-primary hover:underline">Configurações → Faturamento</Link>.
            O acesso permanece ativo até o fim do ciclo já pago. Não há reembolso proporcional para
            ciclos já iniciados, salvo na hipótese do item 1.
          </p>

          <h2 className="text-lg font-semibold">3. Cancelamento de planos anuais</h2>
          <p>
            Para planos anuais, o cancelamento após o prazo de arrependimento gera reembolso
            <strong> proporcional aos meses não utilizados</strong>, descontada multa de 10% sobre o
            valor remanescente. Crédito restituído em até 30 dias por meio do mesmo método de pagamento.
          </p>

          <h2 className="text-lg font-semibold">4. Falha do serviço</h2>
          <p>
            Em caso de indisponibilidade não programada superior a 24 horas em um mesmo mês, o cliente
            poderá solicitar bonificação proporcional, mediante abertura de chamado em{" "}
            <a href="mailto:suporte@wktechnology.com.br" className="text-primary hover:underline">
              suporte@wktechnology.com.br
            </a>.
          </p>

          <h2 className="text-lg font-semibold">5. Tributos e taxas</h2>
          <p>
            Valores de tributos retidos por gateways de pagamento (ex.: IOF, taxas de cartão) podem
            não ser reembolsáveis. O reembolso é feito sobre o valor líquido recebido pela WK Technology.
          </p>

          <h2 className="text-lg font-semibold">6. Como solicitar</h2>
          <p>
            Envie um pedido para{" "}
            <a href="mailto:financeiro@wktechnology.com.br" className="text-primary hover:underline">
              financeiro@wktechnology.com.br
            </a>{" "}
            informando CNPJ/CPF, e-mail da conta e número da fatura. Resposta em até 5 dias úteis.
          </p>
        </section>

        <div className="pt-4 border-t flex gap-4">
          <Link to="/terms" className="text-sm text-primary hover:underline">Termos de Serviço</Link>
          <Link to="/dpa" className="text-sm text-primary hover:underline">DPA</Link>
          <Link to="/privacy" className="text-sm text-primary hover:underline">Privacidade</Link>
        </div>
      </div>
    </div>
  );
}
