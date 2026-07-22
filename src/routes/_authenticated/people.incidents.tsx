// /people/incidents — visão agregada de incidentes de segurança/assédio do workspace.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listIncidents,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  type IncidentSeverity,
} from "@/lib/people/wellbeing.functions";

export const Route = createFileRoute("/_authenticated/people/incidents")({
  head: () => ({
    meta: [
      { title: "Incidentes · TechPeople" },
      { name: "description", content: "Registros de segurança, assédio e discriminação do workspace." },
      { property: "og:title", content: "Incidentes · TechPeople" },
      { property: "og:description", content: "Ocorrências de segurança e conduta do time." },
    ],
  }),
  component: IncidentsListPage,
});

const SEV_TONE: Record<IncidentSeverity, string> = {
  low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  moderate: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function IncidentsListPage() {
  const [sev, setSev] = useState<string>("all");
  const fn = useServerFn(listIncidents);

  const { data = [], isLoading } = useQuery({
    queryKey: ["ws-incidents"],
    queryFn: () => fn({ data: { person_id: null } }),
    staleTime: 30_000,
  });

  const filtered = sev === "all" ? data : data.filter((i) => i.severity === sev);

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-4">
      <PageHeader title="Incidentes" description="Segurança, assédio, discriminação e quase-acidentes." />

      <div className="flex gap-2">
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as severidades</SelectItem>
            {INCIDENT_SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{INCIDENT_SEVERITY_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pessoa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Nenhum incidente registrado</div>
                    <div className="text-xs text-muted-foreground">Registre incidentes na ficha da pessoa (aba Incidentes) ou aqui via API.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => (
                <TableRow key={i.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm">{new Date(i.occurred_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell><Badge variant="outline">{INCIDENT_CATEGORY_LABELS[i.category]}</Badge></TableCell>
                  <TableCell><Badge className={SEV_TONE[i.severity]} variant="outline">{INCIDENT_SEVERITY_LABELS[i.severity]}</Badge></TableCell>
                  <TableCell className="text-sm">{INCIDENT_STATUS_LABELS[i.status]}</TableCell>
                  <TableCell>
                    {i.person_id ? (
                      <Link to="/people/$id" params={{ id: i.person_id }} className="text-sm text-primary hover:underline">Abrir ficha</Link>
                    ) : (<span className="text-xs text-muted-foreground">Sem vínculo</span>)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
