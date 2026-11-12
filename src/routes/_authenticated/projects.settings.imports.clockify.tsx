import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { ImportScheduleCard } from "@/components/integrations/import-schedule/import-schedule-card";
import { ClockifyImportPage } from "@/components/projects/clockify-import/clockify-import-page";

export const Route = createFileRoute("/_authenticated/projects/settings/imports/clockify")({
  head: () => ({
    meta: [
      { title: "Importar do Clockify — TechProjects" },
      {
        name: "description",
        content:
          "Conecte o Clockify, confira a prévia e importe clientes, projetos, tarefas, pessoas e horas para o TechProjects.",
      },
      { property: "og:title", content: "Importar do Clockify — TechProjects" },
      {
        property: "og:description",
        content:
          "Importação segura e retomável do Clockify para o TechProjects, com prévia conferida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Order3RouteAccess,
});

const Order3Page = ClockifyImportPage;
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess resources={["techprojects.clockify_import"]}>
      <Order3Page />
      <div className="px-4 pb-8 md:px-6">
        <ImportScheduleCard provider="clockify" name="Clockify" />
      </div>
    </Order3ScreenAccess>
  );
}
