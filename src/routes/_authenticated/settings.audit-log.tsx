import { formatDateTime } from "@/lib/crm";
// Página /settings/audit-log — histórico de alterações.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RefreshCcw, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/audit-log")({
  component: AuditLogPage,
});

type Row = Awaited<ReturnType<typeof listAuditLogs>>[number];

function AuditLogPage() {
  const fn = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [moduleId, setModuleId] = useState<string>("all");
  const [detail, setDetail] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [entity, action, moduleId]);

  const fmtDate = (s: string) => formatDateTime(s);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Log de auditoria</h2>
          <p className="text-sm text-muted-foreground">
            Registro automático de criação, alteração e exclusão de leads, contatos, empresas e
            negócios.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-[200px_200px_1fr] gap-3 items-end">
            <div className="space-y-1">
              <Label>Entidade</Label>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger>
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
              <Label>Ação</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
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
            <div className="text-sm text-muted-foreground text-right">
              {rows.length} registro(s)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento.</p>
          )}
          {!loading && rows.length > 0 && (
            <div className="text-sm">
              <div className="grid grid-cols-[160px_120px_120px_1fr_180px_60px] gap-2 py-2 border-b text-xs uppercase text-muted-foreground">
                <div>Quando</div>
                <div>Entidade</div>
                <div>Ação</div>
                <div>Mudanças</div>
                <div>Por</div>
                <div></div>
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[160px_120px_120px_1fr_180px_60px] gap-2 items-center py-2 border-b last:border-0"
                >
                  <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                  <span>
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
                  >
                    {AUDIT_ACTION_LABELS[r.action as keyof typeof AUDIT_ACTION_LABELS] ?? r.action}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.action === "updated"
                      ? r.changed_keys.length
                        ? r.changed_keys.slice(0, 5).join(", ") +
                          (r.changed_keys.length > 5 ? "…" : "")
                        : "—"
                      : (r.entity_id ?? "")}
                  </span>
                  <span className="text-xs truncate">
                    {r.actor_name ||
                      r.actor_email ||
                      (r.actor_user_id ? r.actor_user_id.slice(0, 8) : "sistema")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDetail(r)}
                    aria-label="Detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do evento</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Quando:</span>{" "}
                {formatDateTime(row.created_at)}
              </div>
              <div>
                <span className="text-muted-foreground">Por:</span>{" "}
                {row.actor_name || row.actor_email || row.actor_user_id || "sistema"}
              </div>
              <div>
                <span className="text-muted-foreground">Entidade:</span> {row.entity}
              </div>
              <div>
                <span className="text-muted-foreground">ID:</span>{" "}
                <code className="text-xs">{row.entity_id}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Ação:</span> {row.action}
              </div>
            </div>

            {row.action === "updated" && (
              <div>
                <div className="font-medium mb-1">Mudanças</div>
                {diff.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma diferença relevante.</p>
                )}
                {diff.length > 0 && (
                  <div className="border rounded">
                    <div className="grid grid-cols-[160px_1fr_1fr] gap-2 px-2 py-1 border-b text-xs uppercase text-muted-foreground">
                      <div>Campo</div>
                      <div>Antes</div>
                      <div>Depois</div>
                    </div>
                    {diff.map((d) => (
                      <div
                        key={d.key}
                        className="grid grid-cols-[160px_1fr_1fr] gap-2 px-2 py-1 border-b last:border-0 text-xs"
                      >
                        <div className="font-medium">{d.key}</div>
                        <div className="truncate text-muted-foreground">{fmt(d.before)}</div>
                        <div className="truncate">{fmt(d.after)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(row.action === "created" || row.action === "deleted") && (
              <div>
                <div className="font-medium mb-1">Snapshot</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-80">
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
