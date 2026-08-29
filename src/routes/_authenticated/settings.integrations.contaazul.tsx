import { createFileRoute } from "@tanstack/react-router";
import { ContaAzulIntegrationPage } from "@/components/integrations/pages/contaazul-integration-page";

export const Route = createFileRoute("/_authenticated/settings/integrations/contaazul")({
  head: () => ({
    meta: [
      { title: "Conta Azul — Integração TechFinance" },
      {
        name: "description",
        content:
          "Conecte o Conta Azul e importe contas a pagar, a receber, plano de contas e extratos para o TechFinance.",
      },
      { property: "og:title", content: "Conta Azul — Integração TechFinance" },
      {
        property: "og:description",
        content: "Importação e sincronização incremental do Conta Azul no TechFinance.",
      },
    ],
  }),
  component: ContaAzulIntegrationPage,
});
