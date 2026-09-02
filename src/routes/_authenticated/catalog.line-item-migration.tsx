// /catalog/line-item-migration — migração assistida dos itens de linha de
// Negócios legados (texto livre) para a linha de serviço do catálogo.
import { createFileRoute } from "@tanstack/react-router";
import { LineItemMigrationPage } from "@/components/catalog/line-item-migration-page";

export const Route = createFileRoute("/_authenticated/catalog/line-item-migration")({
  head: () => ({
    meta: [
      { title: "Migração de itens de linha para Serviços" },
      {
        name: "description",
        content:
          "Classifique itens de linha de Negócios criados como texto livre nas linhas de serviço do catálogo, com cargo e senioridade.",
      },
      { property: "og:title", content: "Migração de itens de linha para Serviços" },
      {
        property: "og:description",
        content: "Revise e aplique a classificação dos itens de linha legados de Negócios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LineItemMigrationPage,
});
