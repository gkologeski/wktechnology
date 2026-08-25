import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield,
  Download,
  Trash2,
  ClipboardList,
  Clock4,
  AlertTriangle,
  ExternalLink,
  Plus,
} from "lucide-react";
import { AtsPageHeader, AtsSectionHeader, MetricCard, EmptyState } from "@/components/ats/ui";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listDsarRequests,
  createDsarRequest,
  exportCandidateData,
  eraseCandidate,
  updateDsarStatus,
  listRetentionDue,
  type DsarRequest,
  type DsarType,
  type RetentionCandidate,
} from "@/lib/ats/lgpd.functions";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [{ title: "Compliance LGPD · TechHire" }],
  }),
  component: ComplianceHub,
});

function ComplianceHub() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Compliance"
        title="LGPD & DSAR"
        description="Solicitações de titulares (DSAR), retenção de dados e auditoria de anonimização para candidatos."
      />

      <Tabs defaultValue="dsar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dsar">Solicitações DSAR</TabsTrigger>
          <TabsTrigger value="retention">Retenção</TabsTrigger>
        </TabsList>

        <TabsContent value="dsar" className="space-y-4">
          <DsarTab />
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <RetentionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// DSAR Tab
// ============================================================================

function DsarTab() {
  const list = useServerFn(listDsarRequests);
  const q = useQuery<DsarRequest[]>({
    queryKey: ["ats-dsar"],
    queryFn: () => list({ data: {} }),
  });
  const rows = q.data ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const completed = rows.filter((r) => r.status === "completed").length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pendentes"
          value={pending}
          icon={ClipboardList}
          tone={pending > 0 ? "warning" : "neutral"}
          loading={q.isLoading}
        />
        <MetricCard label="Em andamento" value={inProgress} icon={Clock4} loading={q.isLoading} />
        <MetricCard
          label="Concluídas"
          value={completed}
          icon={Shield}
          tone="positive"
          loading={q.isLoading}
        />
        <MetricCard label="Total" value={rows.length} loading={q.isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <AtsSectionHeader
          title="Histórico de solicitações"
          description="Registre cada pedido recebido por e-mail, formulário ou contato direto do titular."
        />
        <NewDsarButton onCreated={() => q.refetch()} />
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="p-4 text-sm text-text-tertiary">Carregando…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Nenhuma solicitação registrada"
              description="Quando um candidato exercer um direito LGPD (acesso, exportação, exclusão), registre aqui para garantir prazo e rastreabilidade."
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <DsarRow key={r.id} row={r} onChanged={() => q.refetch()} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const TYPE_LABEL: Record<DsarType, string> = {
  export: "Exportação",
  erasure: "Exclusão / Anonimização",
  rectification: "Retificação",
  access: "Acesso",
};

function DsarRow({ row, onChanged }: { row: DsarRequest; onChanged: () => void }) {
  const qc = useQueryClient();
  const exportFn = useServerFn(exportCandidateData);
  const eraseFn = useServerFn(eraseCandidate);
  const updateFn = useServerFn(updateDsarStatus);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportM = useMutation({
    mutationFn: () => exportFn({ data: { candidate_id: row.candidate_id, dsar_id: row.id } }),
    onSuccess: (snap) => {
      const blob = new Blob([JSON.stringify(snap, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsar-${row.candidate_id}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
      qc.invalidateQueries({ queryKey: ["ats-dsar"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eraseM = useMutation({
    mutationFn: () =>
      eraseFn({
        data: { candidate_id: row.candidate_id, dsar_id: row.id, confirm: confirmText },
      }),
    onSuccess: () => {
      toast.success("Candidato anonimizado");
      setEraseOpen(false);
      setConfirmText("");
      qc.invalidateQueries({ queryKey: ["ats-dsar"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: () => updateFn({ data: { id: row.id, status: "rejected" } }),
    onSuccess: () => {
      toast.success("Solicitação marcada como rejeitada");
      onChanged();
    },
  });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to="/candidates/$id"
            params={{ id: row.candidate_id }}
            className="text-sm font-medium text-text-primary hover:underline"
          >
            {row.candidate_name ?? "Candidato"}
          </Link>
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABEL[row.request_type]}
          </Badge>
          <DsarStatusBadge status={row.status} />
        </div>
        <div className="mt-0.5 text-xs text-text-tertiary truncate">
          {row.subject_email ?? "—"} · {new Date(row.created_at).toLocaleString("pt-BR")}
          {row.notes ? ` · ${row.notes}` : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {row.status !== "completed" && row.status !== "rejected" ? (
          <>
            {row.request_type === "export" || row.request_type === "access" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportM.mutate()}
                disabled={exportM.isPending}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {exportM.isPending ? "Exportando…" : "Baixar JSON"}
              </Button>
            ) : null}

            {row.request_type === "erasure" ? (
              <Dialog open={eraseOpen} onOpenChange={setEraseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Anonimizar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Anonimizar candidato</DialogTitle>
                    <DialogDescription>
                      Esta ação remove dados pessoais (nome, e-mail, telefone, CV, notas) e revoga
                      consentimentos. Aplicações, scorecards e entrevistas permanecem para
                      estatística. Ação irreversível.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">
                      Digite <span className="font-mono">ANONIMIZAR</span> para confirmar
                    </Label>
                    <Input
                      id="confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="ANONIMIZAR"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEraseOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => eraseM.mutate()}
                      disabled={confirmText !== "ANONIMIZAR" || eraseM.isPending}
                    >
                      {eraseM.isPending ? "Anonimizando…" : "Confirmar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => reject.mutate()}
              disabled={reject.isPending}
            >
              Rejeitar
            </Button>
          </>
        ) : (
          <Link
            to="/candidates/$id"
            params={{ id: row.candidate_id }}
            className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs hover:bg-surface-sunken"
          >
            Abrir
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}

function DsarStatusBadge({ status }: { status: DsarRequest["status"] }) {
  const map: Record<DsarRequest["status"], { label: string; cls: string }> = {
    pending: {
      label: "Pendente",
      cls: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
    },
    in_progress: {
      label: "Em andamento",
      cls: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
    },
    completed: {
      label: "Concluída",
      cls: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
    },
    rejected: {
      label: "Rejeitada",
      cls: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900",
    },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={`text-[10px] ${cls}`}>
      {label}
    </Badge>
  );
}

function NewDsarButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [type, setType] = useState<DsarType>("export");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const create = useServerFn(createDsarRequest);
  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          candidate_id: candidateId.trim(),
          request_type: type,
          subject_email: email.trim() || null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Solicitação registrada");
      setOpen(false);
      setCandidateId("");
      setEmail("");
      setNotes("");
      setType("export");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova solicitação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar DSAR</DialogTitle>
          <DialogDescription>
            Vincule a um candidato existente para garantir rastreabilidade.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cid">ID do candidato</Label>
            <Input
              id="cid"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="UUID do candidato (copie da URL /candidates/...)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de solicitação</Label>
            <Select value={type} onValueChange={(v) => setType(v as DsarType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="export">Exportação de dados</SelectItem>
                <SelectItem value="access">Acesso aos dados</SelectItem>
                <SelectItem value="erasure">Exclusão / Anonimização</SelectItem>
                <SelectItem value="rectification">Retificação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail do titular</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Canal de origem, ID interno, observações"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={!candidateId.trim() || m.isPending}>
            {m.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Retention Tab
// ============================================================================

function RetentionTab() {
  const list = useServerFn(listRetentionDue);
  const q = useQuery<RetentionCandidate[]>({
    queryKey: ["ats-retention-due"],
    queryFn: () => list(),
  });
  const rows = q.data ?? [];
  const critical = rows.filter((r) => r.days_overdue >= 30).length;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Vencidos para retenção"
          value={rows.length}
          icon={AlertTriangle}
          tone={rows.length > 0 ? "warning" : "positive"}
          loading={q.isLoading}
        />
        <MetricCard
          label="Críticos (>30 dias)"
          value={critical}
          icon={AlertTriangle}
          tone={critical > 0 ? "negative" : "neutral"}
          loading={q.isLoading}
        />
        <MetricCard
          label="Anonimização"
          value="Manual"
          hint="Clique em cada candidato para revisar antes de anonimizar"
        />
      </div>

      <AtsSectionHeader
        title="Candidatos com retenção vencida"
        description="Configure a data limite (retention_until) no perfil do candidato. Itens vencidos aparecem aqui para revisão."
      />

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="p-4 text-sm text-text-tertiary">Carregando…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Nenhuma retenção vencida"
              description="Defina retention_until em candidatos rejeitados há mais tempo para acompanhar aqui."
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      to="/candidates/$id"
                      params={{ id: r.id }}
                      className="text-sm font-medium text-text-primary hover:underline"
                    >
                      {r.full_name}
                    </Link>
                    <div className="text-xs text-text-tertiary truncate">
                      {r.email ?? "sem e-mail"} · venceu em{" "}
                      {new Date(r.retention_until).toLocaleDateString("pt-BR")} ·{" "}
                      <span className="font-medium text-text-secondary">
                        {r.days_overdue}d atraso
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/candidates/$id"
                    params={{ id: r.id }}
                    className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs hover:bg-surface-sunken"
                  >
                    Revisar
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
