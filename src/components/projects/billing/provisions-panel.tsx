import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  closeProvision,
  loadProvisions,
  previewProvision,
  type ProvisionSnapshot,
} from "@/lib/hiring/finance.functions";
import { browserTimeZone } from "@/lib/projects/time-entry.shared";
import {
  BILLING_MODEL_LABEL,
  formatMoney,
  issueLabel,
  type BillingModel,
} from "@/lib/projects/billing.shared";

export function ProvisionsPanel({ contractId }: { contractId: string }) {
  const { can } = usePermissions();
  if (!can("techfinance.provisions.view.workspace") || !can("techprojects.rates.view.workspace"))
    return null;
  return <ProvisionsContent key={contractId} contractId={contractId} />;
}
function ProvisionsContent({ contractId }: { contractId: string }) {
  const { can } = usePermissions(),
    qc = useQueryClient();
  const load = useServerFn(loadProvisions),
    preview = useServerFn(previewProvision),
    close = useServerFn(closeProvision);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [timezone, setTimezone] = useState(browserTimeZone);
  const [config, setConfig] = useState(""),
    [reason, setReason] = useState(""),
    [snapshot, setSnapshot] = useState<ProvisionSnapshot | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["hiring-provisions", contractId, month, config],
    queryFn: () => load({ data: { contractId, month: month + "-01", configId: config || null } }),
    retry: false,
    enabled: /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
  });
  const rows = (query.data?.history ?? []).filter((x) => x.config_id === config),
    latest = rows[0];
  const shown = selected
    ? rows.find((x) => x.id === selected)?.snapshot
    : (snapshot ?? latest?.snapshot);
  const pre = useMutation({
    mutationFn: () => preview({ data: { configId: config, month: month + "-01", timezone } }),
    onSuccess: (v) => {
      setSnapshot(v);
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: () =>
      close({
        data: {
          configId: config,
          month: month + "-01",
          timezone,
          hash: snapshot!.hash,
          previousId: latest?.id ?? null,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Provisão registrada; nenhum título foi gerado.");
      setSnapshot(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["hiring-provisions", contractId] });
    },
    onError: (e) => toast.error(e.message),
  });
  const reset = () => {
    setSnapshot(null);
    setSelected(null);
    setPage(1);
  };
  const busy = pre.isPending || save.isPending;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisão mensal</CardTitle>
        <CardDescription>
          Fechamento gerencial por contrato e CNPJ WK. Prévia, histórico e revisão ficam separados
          da medição e do título financeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError ? <p role="alert">{query.error.message}</p> : null}
        {query.data && !query.data.enabled ? (
          <p className="text-sm text-muted-foreground">
            Fechamento integrado ainda não ativado neste workspace.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="provision-month">Competência (AAAA-MM)</Label>
            <Input
              id="provision-month"
              disabled={busy}
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                reset();
              }}
              placeholder="AAAA-MM"
              maxLength={7}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provision-config">Origem / modelo</Label>
            <Select
              disabled={busy}
              value={config}
              onValueChange={(v) => {
                setConfig(v);
                reset();
              }}
            >
              <SelectTrigger id="provision-config">
                <SelectValue placeholder="Selecione o modelo vigente" />
              </SelectTrigger>
              <SelectContent>
                {(query.data?.configs ?? []).map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.model === "cost_monthly"
                      ? "Custo do profissional"
                      : (BILLING_MODEL_LABEL[x.model as BillingModel] ?? x.model)}{" "}
                    · v{x.version} · {x.valid_from} · {x.service_id ? "Serviço" : "Contrato"} ·{" "}
                    {x.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {query.data?.configs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Configure e revise o modelo de cobrança acima para iniciar.
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="provision-tz">Fuso da competência</Label>
          <Input
            id="provision-tz"
            value={timezone}
            disabled={busy}
            onChange={(e) => {
              setTimezone(e.target.value);
              reset();
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={
            !config || busy || query.isLoading || !can("techfinance.provisions.manage.workspace")
          }
          onClick={() => pre.mutate()}
        >
          {pre.isPending ? "Calculando…" : "Calcular prévia"}
        </Button>
        {shown ? (
          <>
            <p className="text-sm text-muted-foreground">
              {shown.notice} Fuso: {shown.timezone}.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {shown.model !== "cost_monthly" && (
                <Metric
                  title="Receita elegível na medição"
                  value={formatMoney(shown.totals.eligible_revenue, shown.currency)}
                />
              )}
              {shown.model !== "cost_monthly" && (
                <Metric
                  title="Estimativa de horas pendentes"
                  value={formatMoney(shown.totals.estimated_pending_revenue, shown.currency)}
                />
              )}
              <Metric
                title="Custo estimado conhecido"
                value={formatMoney(shown.totals.known_estimated_cost, shown.currency)}
              />
            </div>
            <p className="text-sm">
              Custos sem cobertura: {shown.totals.unknown_cost_lines}. Valores desconhecidos não são
              zero; estimativas pendentes não autorizam faturamento.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Composição</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.revenue.slice((page - 1) * 50, page * 50).map((x, i) => (
                  <TableRow key={`r-${i}`}>
                    <TableCell>{x.source_type}</TableCell>
                    <TableCell>
                      {x.issue ? issueLabel(x.issue) : x.included ? "Elegível" : "Excluída"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(x.amount, shown.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                {shown.costs.slice((page - 1) * 50, page * 50).map((x, i) => (
                  <TableRow key={`c-${i}`}>
                    <TableCell>Custo {x.kind === "monthly" ? "mensal" : "por hora"}</TableCell>
                    <TableCell>{x.issue ?? "Estimativa"}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(x.amount, shown.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-2 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>Página {page} · até 50 receitas e 50 custos por página</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 50 >= Math.max(shown.revenue.length, shown.costs.length)}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        ) : null}
        {snapshot && !selected ? (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="provision-reason">Justificativa do fechamento ou da revisão</Label>
            <Textarea
              id="provision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
            <p className="text-sm text-muted-foreground">
              Somente meses encerrados. Uma revisão preserva os valores anteriores e não altera
              títulos, cobranças ou pagamentos.
            </p>
            <Button
              disabled={
                busy ||
                reason.trim().length < 10 ||
                !query.data?.enabled ||
                !can("techfinance.provisions.approve.workspace")
              }
              onClick={() => save.mutate()}
            >
              {save.isPending
                ? "Registrando…"
                : latest
                  ? "Registrar revisão"
                  : "Fechar provisão mensal"}
            </Button>
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="font-medium">Histórico da competência</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum fechamento para o modelo selecionado.
            </p>
          ) : (
            rows.map((x) => (
              <div
                key={x.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    Revisão {x.revision} · {new Date(x.closed_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-muted-foreground">{x.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected(x.id);
                    setSnapshot(null);
                  }}
                >
                  Consultar
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
