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
      <div className="rounded-lg border bg-card p-12 text-center"><Kanban className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Módulo Projetos</h3><p className="mt-2 text-sm text-muted-foreground">Fundação criada. A interface será entregue nas próximas sprints.</p></div>
    </div>
  );
}
