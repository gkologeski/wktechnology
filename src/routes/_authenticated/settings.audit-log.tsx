import { formatDateTime } from "@/lib/crm";
// Página /settings/audit-log — histórico de alterações.
// Lote 8 — alinhada à Design Foundation oficial do TechHire ("quiet premium").
// Mantém integralmente a regra de negócio: usa o mesmo server function
// `listAuditLogs`, mesmos filtros (entity, action, module_id) e mesmo
// detail dialog. Nenhuma mudança em RLS, schema ou autenticação.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAuditLogs, AUDIT_ENTITY_LABELS, AUDIT_ACTION_LABELS } from "@/lib/audit.functions";
import { RefreshCcw, Eye, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader, FilterBar, EmptyState, MetaPill, Skeletons } from "@/components/techhire/ui";

export const Route = createFileRoute("/_authenticated/settings/audit-log")({
  component: AuditLogPage,
});

type Row = Awaited<ReturnType<typeof listAuditLogs>>[number];

function AuditLogPage() {
  const fn = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [moduleId, setModuleId] = useState<string>("all");
  const [detail, setDetail] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await fn({
          data: {
            entity: entity === "all" ? null : (entity as never),
            action: action === "all" ? null : (action as never),
            module_id: moduleId === "all" ? null : moduleId,
            limit: 200,
          },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar eventos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [entity, action, moduleId]);

  const fmtDate = (s: string) => formatDateTime(s);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Segurança & governança"
        title="Log de auditoria"
        description={
          loading
            ? "Carregando eventos…"
            : `${rows.length} registro(s) — criação, alteração e exclusão de leads, contatos, empresas e negócios.`
        }
        descriptionLive
        primaryAction={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        }
      />

      <FilterBar
        chips={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-text-tertiary">Módulo</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger className="h-8 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="crm">TechSales (CRM)</SelectItem>
                  <SelectItem value="ats">TechHire (ATS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-text-tertiary">Entidade</Label>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(
                    Object.keys(AUDIT_ENTITY_LABELS) as Array<keyof typeof AUDIT_ENTITY_LABELS>
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUDIT_ENTITY_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-text-tertiary">Ação</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(
                    Object.keys(AUDIT_ACTION_LABELS) as Array<keyof typeof AUDIT_ACTION_LABELS>
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUDIT_ACTION_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <section className="rounded-xl border border-border-subtle bg-surface-1 shadow-xs">
        {loading ? (
          <div className="p-4">
            <Skeletons.Row />
            <Skeletons.Row />
            <Skeletons.Row />
            <Skeletons.Row />
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState
              icon={AlertTriangle}
              title="Não foi possível carregar o log"
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={load}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ShieldCheck}
              title="Nenhum evento encontrado"
              description="Ajuste os filtros acima ou aguarde novas ações no workspace."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="text-sm min-w-[880px]">
              <div className="grid grid-cols-[160px_88px_140px_120px_minmax(0,1fr)_180px_56px] gap-2 px-4 py-2.5 border-b border-border-subtle text-[11px] uppercase tracking-wider text-text-tertiary bg-surface-2 rounded-t-xl">
                <div>Quando</div>
                <div>Módulo</div>
                <div>Entidade</div>
                <div>Ação</div>
                <div>Mudanças</div>
                <div>Por</div>
                <div className="sr-only">Ações</div>
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[160px_88px_140px_120px_minmax(0,1fr)_180px_56px] gap-2 items-center px-4 py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-2/60 transition-colors"
                >
                  <span className="text-xs text-text-secondary">{fmtDate(r.created_at)}</span>
                  <MetaPill>{(r.module_id ?? "—").toUpperCase()}</MetaPill>
                  <span className="text-text-primary truncate">
                    {AUDIT_ENTITY_LABELS[r.entity as keyof typeof AUDIT_ENTITY_LABELS] ?? r.entity}
                  </span>
                  <Badge
                    variant={
                      r.action === "deleted"
                        ? "destructive"
                        : r.action === "created"
                          ? "default"
                          : "secondary"
                    }
                    className="w-fit"
                  >
                    {AUDIT_ACTION_LABELS[r.action as keyof typeof AUDIT_ACTION_LABELS] ?? r.action}
                  </Badge>
                  <span className="truncate text-xs text-text-secondary">
                    {r.action === "updated"
                      ? r.changed_keys.length
                        ? r.changed_keys.slice(0, 5).join(", ") +
                          (r.changed_keys.length > 5 ? "…" : "")
                        : "—"
                      : (r.entity_id ?? "")}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {r.actor_name ||
                      r.actor_email ||
                      (r.actor_user_id ? r.actor_user_id.slice(0, 8) : "sistema")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDetail(r)}
                    aria-label={`Detalhes do evento ${r.action} em ${r.entity}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <DetailDialog row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function DetailDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const diff = useMemo(() => {
    if (!row) return [] as Array<{ key: string; before: unknown; after: unknown }>;
    const before = (row.before ?? {}) as Record<string, unknown>;
    const after = (row.after ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const out: Array<{ key: string; before: unknown; after: unknown }> = [];
    for (const k of keys) {
      if (k === "updated_at") continue;
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        out.push({ key: k, before: before[k], after: after[k] });
      }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }, [row]);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do evento</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-text-tertiary">Quando:</span> {formatDateTime(row.created_at)}
              </div>
              <div>
                <span className="text-text-tertiary">Por:</span>{" "}
                {row.actor_name || row.actor_email || row.actor_user_id || "sistema"}
              </div>
              <div>
                <span className="text-text-tertiary">Entidade:</span> {row.entity}
              </div>
              <div>
                <span className="text-text-tertiary">ID:</span>{" "}
                <code className="text-xs">{row.entity_id}</code>
              </div>
              <div>
                <span className="text-text-tertiary">Ação:</span> {row.action}
              </div>
            </div>

            {row.action === "updated" && (
              <div>
                <div className="font-medium mb-1 text-text-primary">Mudanças</div>
                {diff.length === 0 && (
                  <p className="text-xs text-text-tertiary">Nenhuma diferença relevante.</p>
                )}
                {diff.length > 0 && (
                  <div className="border border-border-subtle rounded-md overflow-hidden">
                    <div className="grid grid-cols-[160px_1fr_1fr] gap-2 px-2 py-1 border-b border-border-subtle text-[11px] uppercase tracking-wider text-text-tertiary bg-surface-2">
                      <div>Campo</div>
                      <div>Antes</div>
                      <div>Depois</div>
                    </div>
                    {diff.map((d) => (
                      <div
                        key={d.key}
                        className="grid grid-cols-[160px_1fr_1fr] gap-2 px-2 py-1 border-b border-border-subtle last:border-0 text-xs"
                      >
                        <div className="font-medium text-text-primary">{d.key}</div>
                        <div className="truncate text-text-tertiary">{fmt(d.before)}</div>
                        <div className="truncate text-text-primary">{fmt(d.after)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(row.action === "created" || row.action === "deleted") && (
              <div>
                <div className="font-medium mb-1 text-text-primary">Snapshot</div>
                <pre className="text-xs bg-surface-sunken text-text-primary p-2 rounded-md overflow-x-auto max-h-80 border border-border-subtle">
                  {JSON.stringify(row.action === "created" ? row.after : row.before, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
