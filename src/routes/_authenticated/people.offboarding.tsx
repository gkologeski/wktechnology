// /people/offboarding — visão agregada de desligamentos e compliance.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserMinus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listOnbPlans,
  ONB_PLAN_STATUS_LABELS,
  type OnbPlanStatus,
} from "@/lib/people/onboarding.functions";

export const Route = createFileRoute("/_authenticated/people/offboarding")({
  head: () => ({
    meta: [
      { title: "Offboarding · TechPeople" },
      { name: "description", content: "Desligamentos em andamento com checklist de compliance." },
      { property: "og:title", content: "Offboarding · TechPeople" },
      {
        property: "og:description",
        content: "Acompanhe o encerramento de contratos e revogações de acesso.",
      },
    ],
  }),
  component: OffboardingListPage,
});

const STATUS_TONE: Record<OnbPlanStatus, string> = {
  not_started: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  in_progress: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  canceled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function OffboardingListPage() {
  const fn = useServerFn(listOnbPlans);
  const { data = [], isLoading } = useQuery({
    queryKey: ["ws-onb-plans", "offboarding"],
    queryFn: () => fn({ data: {} }),
    staleTime: 30_000,
  });

  const rows = data.filter((p) => p.kind === "offboarding");

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Offboarding"
        description="Desligamentos em andamento e checklist de compliance."
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <UserMinus className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Nenhum offboarding em andamento</div>
                    <div className="text-xs text-muted-foreground">
                      Inicie um plano na ficha da pessoa (aba Onboarding · Desligamento).
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const total = p.progress?.total ?? 0;
                const done = p.progress?.done ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link
                        to="/people/$id"
                        params={{ id: p.person_id }}
                        className="font-medium hover:underline"
                      >
                        {p.person_name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_TONE[p.status]} variant="outline">
                        {ONB_PLAN_STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 w-32" />
                        <span className="text-xs text-muted-foreground">
                          {done}/{total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.started_at ? new Date(p.started_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.target_completion_date ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/people/$id"
                        params={{ id: p.person_id }}
                        className="text-sm text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
