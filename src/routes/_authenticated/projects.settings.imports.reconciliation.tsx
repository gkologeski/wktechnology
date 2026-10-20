import { createFileRoute } from "@tanstack/react-router";
import {
  ReconciliationPage,
  type ReconSearch,
} from "@/components/projects/reconciliation/reconciliation-page";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TABS = ["overview", "breakdown", "issues", "links"] as const;

export const Route = createFileRoute("/_authenticated/projects/settings/imports/reconciliation")({
  validateSearch: (s: Record<string, unknown>): ReconSearch => ({
    tab: TABS.includes(s.tab as (typeof TABS)[number]) ? (s.tab as ReconSearch["tab"]) : undefined,
    from: typeof s.from === "string" && ISO.test(s.from) ? s.from : undefined,
    to: typeof s.to === "string" && ISO.test(s.to) ? s.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Conciliação de horas importadas — TechProjects" },
      {
        name: "description",
        content:
          "Confira o que veio do Clockify e do Jibble, as pendências de revisão e os vínculos com empresas e pessoas.",
      },
      { property: "og:title", content: "Conciliação de horas importadas — TechProjects" },
      {
        property: "og:description",
        content: "Cobertura, conferência mensal, fila de revisão e vínculos das importações de horas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReconciliationRoute,
});

function ReconciliationRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ReconciliationPage
      search={search}
      onSearch={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
