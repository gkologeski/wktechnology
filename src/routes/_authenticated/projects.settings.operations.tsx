import { createFileRoute } from "@tanstack/react-router";
import { ProjectsOpsPage } from "@/components/projects/ops/projects-ops-page";

export const Route = createFileRoute("/_authenticated/projects/settings/operations")({
  head: () => ({
    meta: [
      { title: "Operação e saúde — TechProjects" },
      { name: "description", content: "Agendamentos, filas e últimas execuções do TechProjects no workspace." },
      { property: "og:title", content: "Operação e saúde — TechProjects" },
      { property: "og:description", content: "Situação dos agendamentos e filas, somente leitura, para administradores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsOpsPage,
});
