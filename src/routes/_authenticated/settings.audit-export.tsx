import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import { AUDIT_EXPORT } from "@/lib/access-control/admin-permission-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Play, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listAuditExports,
  upsertAuditExport,
  deleteAuditExport,
  runAuditExportNow,
} from "@/lib/audit-export.functions";

export const Route = createFileRoute("/_authenticated/settings/audit-export")({
  component: AuditExportPage,
});

type Row = {
  id: string;
  name: string;
  destination: "s3" | "webhook" | "email";
  format: "json" | "csv";
  schedule_cron: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  config: Record<string, string>;
  hmac_secret: string | null;
};

function AuditExportPage() {
  const list = useServerFn(listAuditExports);
  const upsert = useServerFn(upsertAuditExport);
  const del = useServerFn(deleteAuditExport);
  const runNow = useServerFn(runAuditExportNow);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const load = async () => setRows((await list({})).items as unknown as Row[]);
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!editing?.name) return toast.error("Nome obrigatório");
    await upsert({
      data: {
        id: editing.id,
        name: editing.name,
        destination: (editing.destination ?? "webhook") as any,
        format: (editing.format ?? "json") as any,
        schedule_cron: editing.schedule_cron ?? "0 2 * * *",
        enabled: editing.enabled ?? true,
        config: editing.config ?? {},
        hmac_secret: editing.hmac_secret ?? undefined,
      },
    });
    setEditing(null);
    await load();
    toast.success("Salvo");
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Exportação de Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Envie logs para S3, webhook ou email em intervalos regulares.
          </p>
        </div>
        <Can any={AUDIT_EXPORT}>
          <Button
            onClick={() =>
              setEditing({
                destination: "webhook",
                format: "json",
                enabled: true,
                schedule_cron: "0 2 * * *",
                config: {},
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Nova exportação
          </Button>
        </Can>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="outline">{r.destination}</Badge>
                  <Badge variant="outline">{r.format.toUpperCase()}</Badge>
                  {!r.enabled && <Badge variant="secondary">desativado</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  cron: <code>{r.schedule_cron}</code>
                  {r.last_run_at && (
                    <>
                      {" "}
                      · última: {formatDateTime(r.last_run_at)} ({r.last_status})
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const x = await runNow({ data: { id: r.id } });
                    if (x.ok) {
                      toast.success(`OK (${(x as { count?: number }).count ?? 0} regs)`);
                    } else {
                      toast.error((x as { error?: string }).error);
                    }
                    load();
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await del({ data: { id: r.id } });
                    load();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma exportação configurada.</p>
        )}
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? "Editar" : "Nova"} exportação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Nome">
              <Input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Destino">
                <Select
                  value={editing.destination}
                  onValueChange={(v) => setEditing({ ...editing, destination: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook (POST)</SelectItem>
                    <SelectItem value="s3">S3 (PUT presigned URL)</SelectItem>
                    <SelectItem value="email">Email (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Formato">
                <Select
                  value={editing.format}
                  onValueChange={(v) => setEditing({ ...editing, format: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {editing.destination === "webhook" && (
              <Field label="URL do webhook">
                <Input
                  value={editing.config?.url ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, config: { ...editing.config, url: e.target.value } })
                  }
                />
              </Field>
            )}
            {editing.destination === "s3" && (
              <Field label="Presigned URL (PUT)">
                <Input
                  value={editing.config?.presigned_url ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      config: { ...editing.config, presigned_url: e.target.value },
                    })
                  }
                />
              </Field>
            )}
            {editing.destination === "email" && (
              <Field label="Email destinatário">
                <Input
                  value={editing.config?.email ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, config: { ...editing.config, email: e.target.value } })
                  }
                />
              </Field>
            )}
            <Field label="Cron schedule">
              <Input
                value={editing.schedule_cron ?? ""}
                onChange={(e) => setEditing({ ...editing, schedule_cron: e.target.value })}
              />
            </Field>
            <Field label="HMAC secret (opcional, assina o body)">
              <Input
                type="password"
                value={editing.hmac_secret ?? ""}
                onChange={(e) => setEditing({ ...editing, hmac_secret: e.target.value })}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.enabled ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
              />
              <Label>Ativo</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
