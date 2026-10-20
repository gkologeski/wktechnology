import { createFileRoute } from "@tanstack/react-router";
import { JibbleImportPage } from "@/components/projects/jibble-import/jibble-import-page";

export const Route = createFileRoute("/_authenticated/projects/settings/imports/jibble")({
  head: () => ({
    meta: [
      { title: "Importar do Jibble — TechProjects" },
      {
        name: "description",
        content:
          "Conecte o Jibble, confira a prévia e importe pessoas, projetos, atividades e o histórico de ponto para o TechProjects.",
      },
      { property: "og:title", content: "Importar do Jibble — TechProjects" },
      {
        property: "og:description",
        content:
          "Importação segura e retomável do Jibble para o TechProjects, com prévia conferida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JibbleImportPage,
});
