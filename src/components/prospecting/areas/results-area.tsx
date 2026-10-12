import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ListPageSkeleton, SectionHeader } from "@/components/techhire/ui";
import { getProspectingResults } from "@/lib/prospecting/overview.functions";
import { CoverageBadge, type Coverage } from "./coverage";

const COL_LABEL: Record<string, string> = {
  tentativas: "Tentativas",
  concluidas: "Concluídas",
  falhas: "Falhas",
  custo_usd: "Custo (US$)",
  publico: "Público",
  enviados: "Enviados",
  atendimentos: "Atendimentos",
  qualificados: "Qualificados",
  reunioes: "Reuniões",
};
const DECISION: Record<string, string> = {
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  nurture: "Nutrição",
  scheduled: "Agendado",
  pending: "Pendente",
};

function Unavailable({ coverage }: { coverage: Coverage }) {
  return (
    <p className="text-sm text-muted-foreground">
      {coverage === "no_access"
        ? "Você não tem permissão para ver esta origem."
        : "Não foi possível consultar esta origem agora."}
    </p>
  );
}

export function ResultsArea() {
  const fetchFn = useServerFn(getProspectingResults);
  const q = useQuery({ queryKey: ["prospecting-results"], queryFn: () => fetchFn() });
  if (q.isLoading) return <ListPageSkeleton />;
  if (q.isError)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar os resultados"
        description={(q.error as Error).message}
        action={
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  const d = q.data!;
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Últimos {d.periodDays} dias. Cada tabela informa dimensão e origem; nada é somado entre
        canais diferentes.
      </p>
      {d.sections.map((s) => {
        const cols = s.rows[0] ? Object.keys(s.rows[0].values) : [];
        return (
          <section key={s.key} className="space-y-3">
            <SectionHeader title={s.title} description={s.origin} action={<CoverageBadge coverage={s.coverage} />} />
            {s.coverage === "no_access" || s.coverage === "error" ? (
              <Unavailable coverage={s.coverage} />
            ) : s.rows.length === 0 ? (
              <EmptyState compact icon={BarChart3} title="Sem registros no período" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{s.rows[0].dimension === "agente" ? "Agente" : "Campanha"}</TableHead>
                    <TableHead>Canal</TableHead>
                    {cols.map((c) => (
                      <TableHead key={c} className="text-right">
                        {COL_LABEL[c] ?? c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.channel}</TableCell>
                      {cols.map((c) => (
                        <TableCell key={c} className="text-right tabular-nums">
                          {r.values[c] == null ? "—" : r.values[c]!.toLocaleString("pt-BR")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
      <section className="space-y-3">
        <SectionHeader
          title="Qualificação e motivos de perda"
          description="Decisões registradas na qualificação da Prospecção."
          action={<CoverageBadge coverage={d.qualification.coverage} />}
        />
        {d.qualification.coverage === "no_access" || d.qualification.coverage === "error" ? (
          <Unavailable coverage={d.qualification.coverage} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(d.qualification.decisions).length === 0 && (
                <span className="text-sm text-muted-foreground">Sem decisões no período.</span>
              )}
              {Object.entries(d.qualification.decisions).map(([k, v]) => (
                <Badge key={k} variant="secondary">
                  {DECISION[k] ?? k}: {v}
                </Badge>
              ))}
            </div>
            <ul className="space-y-1 text-sm">
              {d.qualification.lossReasons.length === 0 && (
                <li className="text-muted-foreground">Nenhum motivo de perda registrado.</li>
              )}
              {d.qualification.lossReasons.map(([reason, n]) => (
                <li key={reason} className="flex justify-between gap-4">
                  <span className="truncate">{reason}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="space-y-2">
        <SectionHeader title="Dimensões sem cobertura" />
        <ul className="space-y-1 text-sm text-muted-foreground">
          {d.notTracked.map((n) => (
            <li key={n.key}>
              <span className="font-medium text-foreground">{n.label}:</span> {n.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
