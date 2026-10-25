import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { ProjectsImportsHub } from "@/components/projects/clockify-import/projects-imports-hub";

export const Route = createFileRoute("/_authenticated/projects/settings/imports/")({
  head: () => ({
    meta: [
      { title: "Importações — TechProjects" },
      { name: "description", content: "Fontes de importação de projetos e horas do TechProjects." },
      { property: "og:title", content: "Importações — TechProjects" },
      {
        property: "og:description",
        content: "Importe projetos e horas de outras ferramentas para o TechProjects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Order3RouteAccess,
});

const Order3Page = ProjectsImportsHub;
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess
      resources={[
        "techprojects.clockify_import",
        "techprojects.jibble_import",
        "techprojects.reconciliation",
      ]}
    >
      <Order3Page />
    </Order3ScreenAccess>
  );
}
