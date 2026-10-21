// Horas e aprovação do projeto: aprovadores/delegação, aceite do cliente, fechamento de
// competência e modelo de entrega. Tudo revalidado no banco; a tela só organiza.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ProjectApproversCard } from "@/components/projects/time-governance/project-approvers-card";
import { ProjectAcceptanceCard } from "@/components/projects/time-governance/project-acceptance-card";
import { ProjectClosingCard } from "@/components/projects/time-governance/project-closing-card";
import { ProjectTemplateCard } from "@/components/projects/time-governance/project-template-card";

export const Route = createFileRoute("/_authenticated/projects_/$id/horas")({
  head: () => ({
    meta: [
      { title: "Horas e aprovação do projeto — TechProjects" },
      {
        name: "description",
        content:
          "Aprovadores, aceite do cliente, fechamento de competência e modelo de entrega do projeto.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectHoursPage,
});

function monthRange(ref: Date) {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1, 12);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12);
  return { from: first.toLocaleDateString("sv-SE"), to: last.toLocaleDateString("sv-SE") };
}

function ProjectHoursPage() {
  const { id } = Route.useParams();
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
  });
  const { from, to } = monthRange(ref);
  const shift = (n: number) => setRef((r) => new Date(r.getFullYear(), r.getMonth() + n, 1, 12));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Horas e aprovação"
        description="Quem aprova, aceite do cliente (opcional), fechamento da competência e modelo de entrega."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/projects/$id" params={{ id }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao projeto
            </Link>
          </Button>
        }
      />
      <ProjectApproversCard projectId={id} />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-[140px] text-center text-sm font-medium">
          {(() => {
            const label = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            return label.charAt(0).toUpperCase() + label.slice(1);
          })()}
        </p>
        <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Competência usada no aceite e no fechamento
        </span>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ProjectAcceptanceCard projectId={id} from={from} to={to} />
        <ProjectClosingCard projectId={id} from={from} to={to} />
      </div>
      <ProjectTemplateCard projectId={id} />
    </div>
  );
}
