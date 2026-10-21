// Tarifas e custos com vigência do TechProjects (Ciclo 4). Leitura e gestão exigem permissões próprias;
// o banco recusa sobreposição, edição de valor e retroatividade sem confirmação.
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { RatesPanel } from "@/components/projects/billing/rates-panel";

export const Route = createFileRoute("/_authenticated/projects/settings/rates")({
  head: () => ({
    meta: [
      { title: "Tarifas e custos — TechProjects" },
      {
        name: "description",
        content:
          "Preços e custos com vigência, precedência declarada e prévia de impacto antes de mudanças retroativas.",
      },
      { property: "og:title", content: "Tarifas e custos — TechProjects" },
      {
        property: "og:description",
        content:
          "Preços e custos com vigência, precedência declarada e prévia de impacto antes de mudanças retroativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RatesPage,
});

function RatesPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Tarifas e custos"
        description="Valores por hora ou custo mensal de alocação, sempre com moeda, unidade e vigência. Nada é preenchido automaticamente."
      />
      <RatesPanel />
    </div>
  );
}
