import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCanDelete, DELETE_NOT_ALLOWED_TITLE } from "@/lib/access-control/use-can-delete";
import { ArrowLeft, Package, Play, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getService,
  updateService,
  deleteService,
  activateService,
} from "@/lib/services.functions";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/services/$id")({
  head: () => ({ meta: [{ title: "Serviço" }] }),
  component: ServiceDetail,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

function ServiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getService);
  const update = useServerFn(updateService);
  const remove = useServerFn(deleteService);
  const activate = useServerFn(activateService);

  const { data: row, isLoading } = useQuery({
    queryKey: ["service", id],
    queryFn: () => get({ data: { id } }),
  });

  const { canDeleteRecord, isLoading: deletePermLoading } = useCanDelete(
    "techsales.catalog.services",
  );
  const canDelete =
    !deletePermLoading && canDeleteRecord(row as Parameters<typeof canDeleteRecord>[0]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [cadence, setCadence] = useState<string>("monthly");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setStatus(row.status ?? "pending");
    setCadence(row.cadence ?? "monthly");
    setQuantity(Number(row.quantity ?? 1));
    setUnitPrice(Number(row.unit_price ?? 0));
    setStartsAt(row.starts_at ? String(row.starts_at).slice(0, 10) : "");
    setEndsAt(row.ends_at ? String(row.ends_at).slice(0, 10) : "");
  }, [row]);

  const { data: entries = [] } = useQuery({
    queryKey: ["service-entries", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount, currency, due_date, status, direction")
        .eq("service_id", id)
        .order("due_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    setSaving(true);
    try {
      await update({
        data: {
          id,
          patch: {
            name,
            description: description || null,
            status: status as any,
            cadence: cadence as any,
            quantity,
            unit_price: unitPrice,
            starts_at: startsAt || null,
            ends_at: endsAt || null,
          },
        },
      });
      toast.success("Alterações salvas.");
      qc.invalidateQueries({ queryKey: ["service", id] });
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function activateNow() {
    try {
      await activate({ data: { id } });
      toast.success("Serviço ativado.");
      qc.invalidateQueries({ queryKey: ["service", id] });
      qc.invalidateQueries({ queryKey: ["service-entries", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function del() {
    if (!canDelete) {
      toast.error(DELETE_NOT_ALLOWED_TITLE);
      return;
    }
    if (!(await confirmDialog("Excluir este serviço?"))) return;
    try {
      await remove({ data: { id } });
      toast.success("Serviço excluído.");
      qc.removeQueries({ queryKey: ["service", id] });
      await qc.invalidateQueries({ queryKey: ["services"] });
      navigate({ to: "/services" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!row) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Serviço não encontrado.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/services" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const contract = (row as any).contracts;
  const amount = Number(quantity) * Number(unitPrice);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/services" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Package className="h-6 w-6 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">{row.name}</h1>
            <p className="text-xs text-muted-foreground">
              {contract ? (
                <Link to="/contracts/$id" params={{ id: contract.id }} className="hover:underline">
                  Contrato {contract.number ?? contract.title}
                </Link>
              ) : (
                "Sem contrato"
              )}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_TONE[row.status] ?? ""}>
            {STATUS_LABEL[row.status] ?? row.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {row.status === "pending" ? (
            <Button variant="outline" onClick={activateNow}>
              <Play className="h-4 w-4 mr-1" /> Ativar
            </Button>
          ) : null}
          <Button variant="outline" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={del}
            disabled={!canDelete}
            aria-disabled={!canDelete}
            title={canDelete ? "Excluir serviço" : DELETE_NOT_ALLOWED_TITLE}
            aria-label="Excluir serviço"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {row.type === "recurring" ? (
                <div className="space-y-2">
                  <Label>Cadência</Label>
                  <Select value={cadence} onValueChange={setCadence}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço unitário</Label>
                <CurrencyCommitInput
                  value={unitPrice}
                  onCommit={(v) => setUnitPrice(typeof v === "number" ? v : 0)}
                  currency={row.currency}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor por ciclo</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(amount, row.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Próxima cobrança</span>
                <span className="tabular-nums">
                  {row.next_billing_at
                    ? formatDateTime(row.next_billing_at as string).split(" ")[0]
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direção</span>
                <span>{row.role === "provider" ? "A receber" : "A pagar"}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lançamentos gerados</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
              ) : (
                <div className="space-y-2">
                  {entries.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <div className="truncate">{e.description}</div>
                        <div className="text-muted-foreground">
                          {formatDateTime(e.due_date).split(" ")[0]} · {e.status}
                        </div>
                      </div>
                      <div className="tabular-nums font-medium">
                        {formatCurrency(Number(e.amount), e.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
