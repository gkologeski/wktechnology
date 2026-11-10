import { createFileRoute } from "@tanstack/react-router";
import { PaymentTermsPrototype } from "@/components/sales/prototype/payment-terms-prototype";

export const Route = createFileRoute("/_authenticated/sales/payment-terms-prototype")({
  head: () => ({
    meta: [
      { title: "Protótipo — Condições de pagamento" },
      { name: "description", content: "Protótipo das condições de pagamento da cotação, com dados de exemplo." },
      { property: "og:title", content: "Protótipo — Condições de pagamento" },
      { property: "og:description", content: "Entrada, parcelas e marcos calculados a partir dos itens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentTermsPrototype,
});
