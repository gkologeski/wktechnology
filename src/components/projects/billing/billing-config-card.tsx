// Modelo de cobrança do contrato/serviço (versionado, sem retroatividade). Quando há serviço, as Medições
// passam a ser donas da cobrança daquele serviço a partir do mês escolhido e o gerador antigo deixa de faturá-lo.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, RowSkeleton, SectionHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  endBillingConfig,
  getContractBillingContext,
  listBillingConfigs,
  saveBillingConfig,
} from "@/lib/projects/billing-rates.functions";
import {
  BILLING_MODELS,
  BILLING_MODEL_LABEL,
  formatMoney,
  hoursToSeconds,
  parseMoneyInput,
  type BillingModel,
} from "@/lib/projects/billing.shared";
import { formatSeconds } from "@/lib/projects/time-entry.shared";

const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "sem fim");
const WHOLE = "__contract__";

function nextMonthStart(offset: number) {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

function describeParams(
  model: BillingModel,
  p: Record<string, string | number | boolean>,
  cur: string,
) {
  const parts: string[] = [];
  if (p.rounding === "line") parts.push("arredonda por linha");
  if (p.require_closed_period === false) parts.push("aceita horas aprovadas sem fechamento");
  else if (model === "per_hour" || model === "package")
    parts.push("só horas de competência fechada");
  if (p.require_client_acceptance) parts.push("exige aceite do cliente");
  if (p.increment_mode && p.increment_mode !== "none")
    parts.push(
      `incremento ${p.increment_seconds}s (${p.increment_mode === "up" ? "para cima" : "mais próximo"})`,
    );
  if (model === "package") {
    parts.push(`franquia ${formatSeconds(Number(p.included_seconds))}`);
    if (p.package_amount !== undefined)
      parts.push(`valor ${formatMoney(Number(p.package_amount), cur)}`);
    if (Number(p.carryover_months ?? 0) > 0) parts.push(`saldo vale ${p.carryover_months} mês(es)`);
  }
  if (model === "fixed_recurring") {
    parts.push(
      p.amount_source === "explicit"
        ? `valor ${formatMoney(Number(p.amount), cur)}`
        : p.amount_source === "service"
          ? "valor do serviço"
          : "valor mensal do contrato",
    );
    parts.push(p.proration === "calendar_days" ? "pró-rata por dias corridos" : "sem pró-rata");
  }
  if (model === "percent") parts.push(p.percent ? `${p.percent}%` : "percentual do serviço");
  return parts.join(" · ");
}

export function BillingConfigCard({ contractId }: { contractId: string }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const ctxFn = useServerFn(getContractBillingContext);
  const listFn = useServerFn(listBillingConfigs);
  const saveFn = useServerFn(saveBillingConfig);
  const endFn = useServerFn(endBillingConfig);
  const canManage = can("techprojects.billing_config.manage.workspace");

  const ctx = useQuery({
    queryKey: ["billing-context", contractId],
    queryFn: () => ctxFn({ data: { contractId } }),
    retry: false,
  });
  const list = useQuery({
    queryKey: ["billing-configs", contractId],
    queryFn: () => listFn({ data: { contractId } }),
    retry: false,
  });

  const [serviceId, setServiceId] = useState(WHOLE);
  const [model, setModel] = useState<BillingModel>("per_hour");
  const [validFrom, setValidFrom] = useState(() => nextMonthStart(0));
  const [reason, setReason] = useState("");
  const [rounding, setRounding] = useState<"total" | "line">("total");
  const [requireClosed, setRequireClosed] = useState(true);
  const [requireAcceptance, setRequireAcceptance] = useState(false);
  const [packageHours, setPackageHours] = useState("");
  const [packageAmount, setPackageAmount] = useState("");
  const [carry, setCarry] = useState("0");
  const [amountSource, setAmountSource] = useState<"service" | "contract_monthly" | "explicit">(
    "service",
  );
  const [explicitAmount, setExplicitAmount] = useState("");
  const [proration, setProration] = useState<"none" | "calendar_days">("none");
  const [percent, setPercent] = useState("");
  const cur = ctx.data?.contract.currency ?? "BRL";
  const isProvider = ctx.data?.contract.role === "provider";

  const buildParams = () => {
    const p: Record<string, string | number | boolean> = { rounding };
    if (requireAcceptance) p.require_client_acceptance = true;
    if (model === "per_hour" || model === "package") p.require_closed_period = requireClosed;
    if (model === "package") {
      if (packageHours.trim()) p.included_seconds = hoursToSeconds(packageHours);
      const amt = parseMoneyInput(packageAmount);
      if (amt !== null) p.package_amount = amt;
      p.carryover_months = Number(carry) || 0;
    }
    if (model === "fixed_recurring") {
      p.amount_source = amountSource;
      p.proration = proration;
      if (amountSource === "explicit") {
        const amt = parseMoneyInput(explicitAmount);
        if (amt !== null) p.amount = amt;
      }
    }
    if (model === "percent" && percent.trim()) p.percent = Number(percent.replace(",", "."));
    return p;
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["billing-configs", contractId] });
    void qc.invalidateQueries({ queryKey: ["measurements"] });
  };
  const save = useMutation({
    mutationFn: (params: Record<string, string | number | boolean>) =>
      saveFn({
        data: {
          contractId,
          serviceId: serviceId === WHOLE ? null : serviceId,
          model,
          params,
          validFrom: `${validFrom}-01`,
          reason: reason.trim(),
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.legacy_entries > 0
          ? `Modelo ativado (v${r.version}). Há ${r.legacy_entries} título(s) do gerador antigo a partir desta data: aparecerão como pendência para vincular ou resolver.`
          : `Modelo ativado (v${r.version}).`,
      );
      setReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const end = useMutation({
    mutationFn: (configId: string) =>
      endFn({
        data: {
          configId,
          end: `${nextMonthStart(1)}-01`,
          reason: "Encerrado pela tela do contrato",
        },
      }),
    onSuccess: () => {
      toast.success("Modelo encerrado a partir do próximo mês.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Modelo de cobrança"
        description="Sem modelo não há medição. Vale do mês escolhido em diante (sem retroatividade); mudar cria nova versão. Por serviço, as Medições passam a ser donas da cobrança e o gerador antigo deixa de faturar aquele serviço."
      />
      {list.isLoading || ctx.isLoading ? (
        <RowSkeleton />
      ) : list.isError ? (
        <EmptyState title="Modelos indisponíveis" description={(list.error as Error).message} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum modelo de cobrança"
          description="Este contrato ainda não tem modelo de medição configurado."
          compact
        />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {(list.data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">
                  {c.service_name ?? "Contrato inteiro"} · {BILLING_MODEL_LABEL[c.model]}{" "}
                  <Badge variant="outline">v{c.version}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {br(c.valid_from)} a {br(c.valid_to)} · {c.currency} ·{" "}
                  {describeParams(c.model, c.params, c.currency)}
                </p>
              </div>
              {canManage && !c.valid_to && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={end.isPending}
                  onClick={() =>
                    void confirmDialog({
                      title: "Encerrar o modelo?",
                      description:
                        "Vale até o fim deste mês. Medições futuras ficam bloqueadas até novo modelo.",
                      confirmLabel: "Encerrar",
                    }).then((ok) => ok && end.mutate(c.id))
                  }
                >
                  Encerrar no próximo mês
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        ctx.data &&
        (isProvider ? (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Novo modelo / nova versão</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="bc-svc">Escopo</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger id="bc-svc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WHOLE}>Contrato inteiro</SelectItem>
                    {ctx.data.services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="bc-model">Modelo</Label>
                <Select value={model} onValueChange={(v) => setModel(v as BillingModel)}>
                  <SelectTrigger id="bc-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {BILLING_MODEL_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="bc-from">Vale a partir de</Label>
                <Input
                  id="bc-from"
                  type="month"
                  min={nextMonthStart(0)}
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="bc-round">Arredondamento (2 casas)</Label>
                <Select value={rounding} onValueChange={(v) => setRounding(v as "total" | "line")}>
                  <SelectTrigger id="bc-round">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">No total da medição</SelectItem>
                    <SelectItem value="line">Em cada linha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(model === "per_hour" || model === "package") && (
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="bc-closed"
                    checked={requireClosed}
                    onCheckedChange={setRequireClosed}
                  />
                  <Label htmlFor="bc-closed">Só horas de competência fechada</Label>
                </div>
              )}
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="bc-acc"
                  checked={requireAcceptance}
                  onCheckedChange={setRequireAcceptance}
                />
                <Label htmlFor="bc-acc">Exigir aceite do cliente</Label>
              </div>
            </div>
            {model === "package" && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1">
                  <Label htmlFor="bc-hours">Franquia mensal (horas)</Label>
                  <Input
                    id="bc-hours"
                    value={packageHours}
                    onChange={(e) => setPackageHours(e.target.value)}
                    placeholder="ex.: 40 ou 39:30"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bc-pamt">Valor do pacote ({cur})</Label>
                  <Input
                    id="bc-pamt"
                    inputMode="decimal"
                    value={packageAmount}
                    onChange={(e) => setPackageAmount(e.target.value)}
                    placeholder="vazio = sem valor fixo"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="bc-carry">Saldo não usado vale por (meses)</Label>
                  <Input
                    id="bc-carry"
                    type="number"
                    min={0}
                    max={24}
                    value={carry}
                    onChange={(e) => setCarry(e.target.value)}
                  />
                </div>
              </div>
            )}
            {model === "fixed_recurring" && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1">
                  <Label htmlFor="bc-src">Valor mensal</Label>
                  <Select
                    value={amountSource}
                    onValueChange={(v) => setAmountSource(v as typeof amountSource)}
                  >
                    <SelectTrigger id="bc-src">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Do serviço (quantidade × preço)</SelectItem>
                      <SelectItem value="contract_monthly">Valor mensal do contrato</SelectItem>
                      <SelectItem value="explicit">Valor informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {amountSource === "explicit" && (
                  <div className="grid gap-1">
                    <Label htmlFor="bc-amt">Valor ({cur})</Label>
                    <Input
                      id="bc-amt"
                      inputMode="decimal"
                      value={explicitAmount}
                      onChange={(e) => setExplicitAmount(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid gap-1">
                  <Label htmlFor="bc-pro">Pró-rata no mês de início/fim</Label>
                  <Select
                    value={proration}
                    onValueChange={(v) => setProration(v as typeof proration)}
                  >
                    <SelectTrigger id="bc-pro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem pró-rata (mês cheio)</SelectItem>
                      <SelectItem value="calendar_days">Dias corridos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {model === "percent" && (
              <div className="grid gap-1 md:w-1/3">
                <Label htmlFor="bc-pct">Percentual (vazio = o do serviço)</Label>
                <Input
                  id="bc-pct"
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1">
              <Label htmlFor="bc-reason">Motivo (mín. 10 caracteres)</Label>
              <Textarea
                id="bc-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              disabled={save.isPending || reason.trim().length < 10}
              onClick={() => {
                try {
                  const params = buildParams();
                  void confirmDialog({
                    title: "Ativar modelo de cobrança?",
                    description:
                      serviceId === WHOLE
                        ? "Medições do contrato inteiro a partir do mês escolhido."
                        : "A partir do mês escolhido, este serviço passa a ser cobrado só pelas Medições; o gerador antigo deixa de faturá-lo.",
                    confirmLabel: "Ativar",
                  }).then((ok) => ok && save.mutate(params));
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Ativar modelo
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Contrato de compra: medições de receita não se aplicam.
          </p>
        ))}
    </section>
  );
}
