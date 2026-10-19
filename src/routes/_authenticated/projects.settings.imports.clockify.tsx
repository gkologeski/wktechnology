import { createFileRoute } from "@tanstack/react-router";
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
        content: "Importação segura e retomável do Clockify para o TechProjects, com prévia conferida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClockifyImportPage,
});
