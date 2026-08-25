import { getPublicAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/crm";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewSurveyDialog } from "@/components/surveys/new-survey-dialog";
import { EditResponseDialog } from "@/components/surveys/edit-response-dialog";
import { SurveyTemplatesTab } from "@/components/surveys/survey-templates-tab";
import {
  SurveyTypePickerDialog,
  type SurveyKindTab,
} from "@/components/surveys/survey-type-picker-dialog";
import { QuestionnairesTab } from "@/components/prospecting/questionnaires-tab";

type Survey = {
  id: string;
  ticket_id: string;
  kind: "csat" | "nps";
  token: string;
  score: number | null;
  comment: string | null;
  sent_at: string;
  responded_at: string | null;
};

export function SurveysPage() {
  const [tab, setTab] = useState<SurveyKindTab>("csat");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);

  const qc = useQueryClient();

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, ticket_id, kind, token, score, comment, sent_at, responded_at")
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Survey[];
    },
  });

  const ticketIds = useMemo(() => Array.from(new Set(surveys.map((s) => s.ticket_id))), [surveys]);

  const { data: ticketAgents = {} } = useQuery({
    queryKey: ["survey-ticket-agents", ticketIds],
    enabled: ticketIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, assignee_id")
        .in("id", ticketIds);
      if (error) throw error;
      const m: Record<string, string | null> = {};
      for (const t of data ?? []) m[t.id as string] = (t.assignee_id as string | null) ?? null;
      return m;
    },
  });

  const agentIds = useMemo(
    () => Array.from(new Set(Object.values(ticketAgents).filter(Boolean) as string[])),
    [ticketAgents],
  );

  const { data: agentNames = {} } = useQuery({
    queryKey: ["survey-agent-names", agentIds],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", agentIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const p of data ?? []) m[p.id as string] = (p.full_name as string | null) ?? "Sem nome";
      return m;
    },
  });

  const filtered = useMemo(() => surveys.filter((s) => s.kind === tab), [surveys, tab]);

  const stats = useMemo(() => {
    const answered = filtered.filter((s) => s.score !== null);
    if (tab === "nps") {
      const promoters = answered.filter((s) => (s.score ?? 0) >= 9).length;
      const detractors = answered.filter((s) => (s.score ?? 0) <= 6).length;
      const nps = answered.length
        ? Math.round(((promoters - detractors) / answered.length) * 100)
        : null;
      return { total: filtered.length, answered: answered.length, nps, avg: null as number | null };
    }
    const avg = answered.length
      ? answered.reduce((a, s) => a + (s.score ?? 0), 0) / answered.length
      : null;
    return { total: filtered.length, answered: answered.length, nps: null, avg };
  }, [filtered, tab]);

  const perAgent = useMemo(() => {
    const groups = new Map<
      string,
      { answered: number; sum: number; promoters: number; detractors: number }
    >();
    for (const s of filtered) {
      if (s.score === null) continue;
      const agentId = ticketAgents[s.ticket_id] ?? "unassigned";
      const g = groups.get(agentId) ?? { answered: 0, sum: 0, promoters: 0, detractors: 0 };
      g.answered += 1;
      g.sum += s.score;
      if (s.score >= 9) g.promoters += 1;
      if (s.score <= 6) g.detractors += 1;
      groups.set(agentId, g);
    }
    return Array.from(groups.entries())
      .map(([agentId, g]) => ({
        agentId,
        name: agentId === "unassigned" ? "Sem responsável" : (agentNames[agentId] ?? "—"),
        answered: g.answered,
        avg: g.answered ? g.sum / g.answered : 0,
        nps: g.answered ? Math.round(((g.promoters - g.detractors) / g.answered) * 100) : 0,
      }))
      .sort((a, b) => b.answered - a.answered);
  }, [filtered, ticketAgents, agentNames]);

  const isResults = tab === "csat" || tab === "nps";

  function copyLink(token: string) {
    const url = `${getPublicAppUrl()}/survey/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Pesquisas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Modelos de CSAT e NPS (com disparo automático em tickets), questionários de vendas e
              formulários livres. Todas podem ser respondidas na timeline das entidades.
            </p>
          </div>
          <Button size="sm" onClick={() => setTypePickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova pesquisa
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as SurveyKindTab)}>
            <TabsList>
              <TabsTrigger value="csat">CSAT</TabsTrigger>
              <TabsTrigger value="nps">NPS</TabsTrigger>
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="livre">Livre</TabsTrigger>
            </TabsList>
            <TabsContent value="csat" className="mt-4">
              <SurveyTemplatesTab kind="csat" />
            </TabsContent>
            <TabsContent value="nps" className="mt-4">
              <SurveyTemplatesTab kind="nps" />
            </TabsContent>
            <TabsContent value="vendas" className="mt-4">
              <QuestionnairesTab />
            </TabsContent>
            <TabsContent value="livre" className="mt-4">
              <SurveyTemplatesTab kind="form" />
            </TabsContent>
          </Tabs>

          {isResults && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Respostas recebidas</p>
              <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Enviar para um ticket
              </Button>
            </div>
          )}

          {isResults && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Convites" value={String(stats.total)} />
              <Stat label="Respondidas" value={String(stats.answered)} />
              {tab === "nps" ? (
                <Stat label="NPS" value={stats.nps !== null ? `${stats.nps}` : "—"} />
              ) : (
                <Stat label="Média (0–5)" value={stats.avg !== null ? stats.avg.toFixed(2) : "—"} />
              )}
              <Stat
                label="Taxa de resposta"
                value={stats.total ? `${Math.round((stats.answered / stats.total) * 100)}%` : "—"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {isResults && perAgent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por responsável</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                  <TableHead className="text-right">{tab === "nps" ? "NPS" : "Média"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perAgent.map((row) => (
                  <TableRow key={row.agentId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.answered}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tab === "nps" ? row.nps : row.avg.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isResults && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Respondido</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma pesquisa.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(s.sent_at)}
                    </TableCell>
                    <TableCell>
                      {s.score !== null ? (
                        <Badge
                          variant={
                            tab === "nps"
                              ? s.score >= 9
                                ? "default"
                                : s.score <= 6
                                  ? "destructive"
                                  : "secondary"
                              : s.score >= 4
                                ? "default"
                                : s.score >= 3
                                  ? "secondary"
                                  : "destructive"
                          }
                        >
                          {s.score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm">{s.comment ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.responded_at ? formatDateTime(s.responded_at) : "—"}
                    </TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(s)}
                        title="Editar resposta"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(s.token)}
                        title="Copiar link público"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SurveyTypePickerDialog
        open={typePickerOpen}
        onOpenChange={setTypePickerOpen}
        onSelect={(kind) => setTab(kind)}
      />
      <NewSurveyDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["surveys"] })}
      />
      <EditResponseDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        survey={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["surveys"] })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
