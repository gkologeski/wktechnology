// /people/psychosocial — visão agregada de avaliações psicossociais do workspace.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PSYCH_RISK_LEVELS,
  PSYCH_RISK_LABELS,
  PSYCH_STATUS_LABELS,
  type PsychAssessmentRow,
  type PsychRiskLevel,
} from "@/lib/people/wellbeing.functions";

// Server function agregada — lista todas as avaliações do workspace do usuário
// (RLS/can_view_person_sensitive garante o gate).
const listWorkspacePsychAssessments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        risk_level: z.enum(PSYCH_RISK_LEVELS).nullable().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("people_psychosocial_assessments")
      .select("*, people(id, full_name)")
      .order("assessed_at", { ascending: false })
      .limit(data.limit);
    if (data.risk_level) q = q.eq("risk_level", data.risk_level);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as (PsychAssessmentRow & {
      people?: { id: string; full_name: string } | null;
    })[];
  });
void supabase; // silence lint — client available if needed later

export const Route = createFileRoute("/_authenticated/people/psychosocial")({
  head: () => ({
    meta: [
      { title: "Riscos psicossociais · TechPeople" },
      { name: "description", content: "Avaliações NR-1 e sinais de risco psicossocial do time." },
      { property: "og:title", content: "Riscos psicossociais · TechPeople" },
      { property: "og:description", content: "Monitoramento de bem-estar e sinais de burnout." },
    ],
  }),
  component: PsychosocialListPage,
});

const RISK_TONE: Record<PsychRiskLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  moderate: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function PsychosocialListPage() {
  const [risk, setRisk] = useState<string>("all");
  const fn = useServerFn(listWorkspacePsychAssessments);

  const { data = [], isLoading } = useQuery({
    queryKey: ["ws-psych", risk],
    queryFn: () =>
      fn({
        data: { risk_level: risk === "all" ? null : (risk as PsychRiskLevel), limit: 200 },
      }),
    staleTime: 30_000,
  });

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Riscos psicossociais"
        description="Avaliações e sinais de risco em todo o workspace."
      />
      <div className="flex gap-2">
        <Select value={risk} onValueChange={setRisk}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Nível de risco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {PSYCH_RISK_LEVELS.map((r) => (
              <SelectItem key={r} value={r}>
                {PSYCH_RISK_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Sinais</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Brain className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Nenhuma avaliação encontrada</div>
                    <div className="text-xs text-muted-foreground">
                      Registre avaliações na ficha da pessoa (aba Psicossocial).
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40">
                  <TableCell>
                    {a.people ? (
                      <Link
                        to="/people/$id"
                        params={{ id: a.people.id }}
                        className="font-medium hover:underline"
                      >
                        {a.people.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(a.assessed_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge className={RISK_TONE[a.risk_level]} variant="outline">
                      {PSYCH_RISK_LABELS[a.risk_level]}
                      {a.overall_score != null ? ` · ${a.overall_score.toFixed(1)}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {a.burnout_signals && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" /> Burnout
                        </Badge>
                      )}
                      {a.harassment_signals && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/30"
                        >
                          Assédio
                        </Badge>
                      )}
                      {!a.burnout_signals && !a.harassment_signals && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{PSYCH_STATUS_LABELS[a.status]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.follow_up_at ? new Date(a.follow_up_at).toLocaleDateString("pt-BR") : "—"}
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
