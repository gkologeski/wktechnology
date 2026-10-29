import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { ClickUpImportPage } from "@/components/projects/clickup-import/clickup-import-page";

export const Route = createFileRoute("/_authenticated/projects/settings/imports/clickup")({
  head: () => ({
    meta: [
      { title: "Importar do ClickUp — TechProjects" },
      {
        name: "description",
        content:
          "Leia espaços, listas e tarefas do ClickUp, revise a organização e os responsáveis e importe para o TechProjects sem duplicar.",
      },
      { property: "og:title", content: "Importar do ClickUp — TechProjects" },
      {
        property: "og:description",
        content: "Importação revisável e reversível do ClickUp para o TechProjects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Order3RouteAccess,
});

const Order3Page = ClickUpImportPage;
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess resources={["techprojects.clickup_import"]}>
      <Order3Page />
    </Order3ScreenAccess>
  );
}
