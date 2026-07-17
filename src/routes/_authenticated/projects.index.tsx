import { createFileRoute } from "@tanstack/react-router";
import { Kanban } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projetos" },
      { name: "description", content: "Gestão de projetos (PSA) com apontamento de horas e marcos." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Projetos" description="Entregas com marcos billáveis, timesheet e custo x receita." />
      <EmptyState
        icon={Kanban}
        title="Módulo Projetos"
        description="Fundação criada. A interface será entregue nas próximas sprints."
      />
    </div>
  );
}
