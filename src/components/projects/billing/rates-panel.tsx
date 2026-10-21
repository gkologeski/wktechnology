// Tarifas e custos com vigência [início, fim): criação, divisão de vigência e encerramento, com prévia de
// impacto e confirmação para datas retroativas. Valores legados aparecem só para revisão (nada é adotado sozinho).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, RowSkeleton, SectionHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  createRate,
  endRate,
  listLegacyRateCandidates,
  listRateTargets,
  listRates,
  previewRateImpact,
  splitRate,
} from "@/lib/projects/billing-rates.functions";
import {
  RATE_PRECEDENCE,
  RATE_SCOPE_LABEL,
  formatMoney,
  parseMoneyInput,
} from "@/lib/projects/billing.shared";
import { formatSeconds } from "@/lib/projects/time-entry.shared";
import type { RateImpact } from "@/lib/projects/billing.types";

type Scope = "exception" | "allocation" | "service" | "person" | "catalog";
const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "sem fim");
const today = () => new Date().toLocaleDateString("sv-SE");
const monthStart = () => `${today().slice(0, 7)}-01`;

export function RatesPanel() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canManage = can("techprojects.rates.manage.workspace");
  const listFn = useServerFn(listRates);
  const targetsFn = useServerFn(listRateTargets);
  const legacyFn = useServerFn(listLegacyRateCandidates);
  const createFn = useServerFn(createRate);
  const splitFn = useServerFn(splitRate);
  const endFn = useServerFn(endRate);
  const impactFn = useServerFn(previewRateImpact);

  const rates = useQuery({ queryKey: ["project-rates"], queryFn: () => listFn(), retry: false });
  const targets = useQuery({
    queryKey: ["project-rate-targets"],
    queryFn: () => targetsFn(),
    enabled: canManage,
    retry: false,
  });
  const legacy = useQuery({
    queryKey: ["project-rate-legacy"],
    queryFn: () => legacyFn(),
    retry: false,
  });

  const [kind, setKind] = useState<"cost" | "price">("price");
  const [scope, setScope] = useState<Scope>("service");
  const [targetId, setTargetId] = useState("");
  const [userId, setUserId] = useState("");
  const [unit, setUnit] = useState<"hour" | "month">("hour");
  const [proration, setProration] = useState<"full_month" | "calendar_days">("full_month");
  const [currency, setCurrency] = useState("BRL");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [confirmException, setConfirmException] = useState(false);
  const [impact, setImpact] = useState<RateImpact | null>(null);
  const [filter, setFilter] = useState<"all" | "cost" | "price">("all");
  const [splitFor, setSplitFor] = useState<string | null>(null);
  const [splitDate, setSplitDate] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitReason, setSplitReason] = useState("");

  const retro = from < monthStart();
  const target = useMemo(() => {
    const t: Record<string, string | boolean> = {};
    if (scope === "exception") {
      if (targetId) t.project_id = targetId;
      if (userId) t.user_id = userId;
      t.confirm_exception = confirmException;
    } else if (targetId) {
      t[
        {
          allocation: "allocation_id",
          service: "service_id",
          person: "person_id",
          catalog: "service_catalog_id",
        }[scope]
      ] = targetId;
    }
    return t;
  }, [scope, targetId, userId, confirmException]);
  const options = targets.data;
  const targetList =
    scope === "exception"
      ? options?.projects
      : scope === "allocation"
        ? options?.allocations
        : scope === "service"
          ? options?.services
          : scope === "person"
            ? options?.people
            : options?.catalog;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["project-rates"] });
    void qc.invalidateQueries({ queryKey: ["profitability"] });
  };
  const preview = useMutation({
    mutationFn: () => impactFn({ data: { scope, target, from, to: to || null } }),
    onSuccess: (r) => setImpact(r),
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: () => {
      const value = parseMoneyInput(amount);
      if (value === null) throw new Error("Informe o valor (zero só se autorizado).");
      return createFn({
        data: {
          kind,
          scope,
          target,
          unit,
          proration: unit === "month" ? proration : null,
          currency,
          amount: value,
          validFrom: from,
          validTo: to || null,
          reason: reason.trim(),
          confirmRetroactive: retro && impact !== null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tarifa registrada.");
      setAmount("");
      setReason("");
      setImpact(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const split = useMutation({
    mutationFn: (rateId: string) => {
      const value = parseMoneyInput(splitAmount);
      if (value === null) throw new Error("Informe o novo valor.");
      return splitFn({
        data: {
          rateId,
          effective: splitDate,
          amount: value,
          reason: splitReason.trim(),
          confirmRetroactive: splitDate < monthStart(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Vigência dividida; a anterior foi preservada.");
      setSplitFor(null);
      setSplitAmount("");
      setSplitReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const end = useMutation({
    mutationFn: ({ rateId, date }: { rateId: string; date: string }) =>
      endFn({
        data: {
          rateId,
          end: date,
          reason: "Encerrada pela tela de tarifas",
          confirmRetroactive: false,
        },
      }),
    onSuccess: () => {
      toast.success("Vigência encerrada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (rates.data ?? []).filter((r) => filter === "all" || r.kind === filter);
  const monthOnly = unit === "month";

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <SectionHeader
          title="Precedência"
          description="Para cada apontamento vale a tarifa vigente na data dele. Mais de uma no mesmo nível = ambígua (não é escolhida). Sem tarifa = valor desconhecido, nunca zero; zero só quando cadastrado."
        />
        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
          {RATE_PRECEDENCE.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      {canManage && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <SectionHeader
            title="Nova tarifa ou custo"
            description="Moeda e unidade explícitas. Valor mensal só como custo de alocação/pessoa e nunca vira hora por divisão presumida."
          />
          <div className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-1">
              <Label htmlFor="r-kind">Tipo</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v as "cost" | "price");
                  if (v === "price") setUnit("hour");
                }}
              >
                <SelectTrigger id="r-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Preço (receita)</SelectItem>
                  <SelectItem value="cost">Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-scope">Escopo</Label>
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as Scope);
                  setTargetId("");
                  setImpact(null);
                }}
              >
                <SelectTrigger id="r-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RATE_SCOPE_LABEL) as Scope[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {RATE_SCOPE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <Label htmlFor="r-target">
                {scope === "exception" ? "Projeto" : RATE_SCOPE_LABEL[scope]}
              </Label>
              <Select
                value={targetId}
                onValueChange={(v) => {
                  setTargetId(v);
                  setImpact(null);
                }}
              >
                <SelectTrigger id="r-target">
                  <SelectValue placeholder={targets.isLoading ? "Carregando…" : "Escolha"} />
                </SelectTrigger>
                <SelectContent>
                  {(targetList ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scope === "exception" && (
              <>
                <div className="grid gap-1 md:col-span-2">
                  <Label htmlFor="r-user">Pessoa (membro ativo)</Label>
                  <Select
                    value={userId}
                    onValueChange={(v) => {
                      setUserId(v);
                      setImpact(null);
                    }}
                  >
                    <SelectTrigger id="r-user">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.members ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6 md:col-span-2">
                  <Checkbox
                    id="r-confirm"
                    checked={confirmException}
                    onCheckedChange={(v) => setConfirmException(v === true)}
                  />
                  <Label htmlFor="r-confirm">
                    Confirmo esta exceção específica (prevalece sobre as demais)
                  </Label>
                </div>
              </>
            )}
            <div className="grid gap-1">
              <Label htmlFor="r-unit">Unidade</Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as "hour" | "month")}
                disabled={kind === "price"}
              >
                <SelectTrigger id="r-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Por hora</SelectItem>
                  <SelectItem value="month">Por mês (custo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {monthOnly && (
              <div className="grid gap-1">
                <Label htmlFor="r-pro">Mês parcial</Label>
                <Select
                  value={proration}
                  onValueChange={(v) => setProration(v as typeof proration)}
                >
                  <SelectTrigger id="r-pro">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_month">Mês cheio</SelectItem>
                    <SelectItem value="calendar_days">Dias corridos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1">
              <Label htmlFor="r-cur">Moeda</Label>
              <Input
                id="r-cur"
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-amount">Valor</Label>
              <Input
                id="r-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0 só se autorizado"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-from">Início (inclusive)</Label>
              <Input
                id="r-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setImpact(null);
                }}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-to">Fim (exclusivo, opcional)</Label>
              <Input
                id="r-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setImpact(null);
                }}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="r-reason">Motivo (mín. 5 caracteres)</Label>
            <Textarea
              id="r-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {impact && (
            <p className="text-sm" role="status">
              Impacto: {impact.entries} apontamento(s), {formatSeconds(impact.seconds)} no
              intervalo; {impact.measured_non_draft} medição(ões) já revisadas/aprovadas/geradas
              ficam como estão (prévias aprovadas passam a exigir revisão); {impact.measured_draft}{" "}
              rascunho(s) mudam ao atualizar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!targetId || preview.isPending}
              onClick={() => preview.mutate()}
            >
              Ver impacto
            </Button>
            <Button
              disabled={
                create.isPending ||
                !targetId ||
                reason.trim().length < 5 ||
                !amount.trim() ||
                (retro && !impact)
              }
              onClick={() => create.mutate()}
            >
              {retro ? "Confirmar tarifa retroativa" : "Registrar tarifa"}
            </Button>
            {retro && !impact && (
              <span className="self-center text-xs text-muted-foreground">
                Data retroativa: veja o impacto antes.
              </span>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <SectionHeader
          title="Vigências"
          description="Valor nunca é editado: mudar divide a vigência (a anterior termina no dia da mudança)."
        />
        <div className="w-48">
          <Label htmlFor="r-filter" className="sr-only">
            Filtrar
          </Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger id="r-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Custos e preços</SelectItem>
              <SelectItem value="price">Só preços</SelectItem>
              <SelectItem value="cost">Só custos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rates.isLoading ? (
          <RowSkeleton />
        ) : rates.isError ? (
          <EmptyState title="Tarifas indisponíveis" description={(rates.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma tarifa cadastrada"
            description="Sem tarifa, custos e valores por hora ficam como desconhecidos."
            compact
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={r.kind === "price" ? "default" : "secondary"}>
                        {r.kind === "price" ? "Preço" : "Custo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{RATE_SCOPE_LABEL[r.scope] ?? r.scope}</TableCell>
                    <TableCell>{r.target_label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.amount, r.currency)}/{r.unit === "hour" ? "h" : "mês"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {br(r.valid_from)} → {br(r.valid_to)} · v{r.version}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.reason}>
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage &&
                        !r.valid_to &&
                        (splitFor === r.id ? (
                          <div className="flex flex-wrap items-end justify-end gap-1">
                            <Input
                              aria-label="Data da mudança"
                              type="date"
                              className="w-36"
                              value={splitDate}
                              onChange={(e) => setSplitDate(e.target.value)}
                            />
                            <Input
                              aria-label="Novo valor"
                              inputMode="decimal"
                              className="w-24"
                              value={splitAmount}
                              onChange={(e) => setSplitAmount(e.target.value)}
                            />
                            <Input
                              aria-label="Motivo"
                              className="w-40"
                              value={splitReason}
                              onChange={(e) => setSplitReason(e.target.value)}
                              placeholder="Motivo"
                            />
                            <Button
                              size="sm"
                              disabled={
                                split.isPending ||
                                !splitDate ||
                                !splitAmount ||
                                splitReason.trim().length < 5
                              }
                              onClick={() => split.mutate(r.id)}
                            >
                              Dividir
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSplitFor(null)}>
                              Fechar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSplitFor(r.id);
                                setSplitDate(today());
                              }}
                            >
                              Mudar valor
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={end.isPending || today() <= r.valid_from}
                              onClick={() => end.mutate({ rateId: r.id, date: today() })}
                            >
                              Encerrar hoje
                            </Button>
                          </div>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <SectionHeader
          title="Valores legados para revisão"
          description="Campos antigos de membros, alocações e serviços sem unidade, moeda ou vigência confirmadas. Não entram em cálculo; cadastre a tarifa acima se forem válidos."
        />
        {legacy.isLoading ? (
          <RowSkeleton />
        ) : legacy.isError ? (
          <EmptyState title="Indisponível" description={(legacy.error as Error).message} compact />
        ) : (
          <ul className="space-y-1 text-sm">
            {(legacy.data?.project_members ?? []).map((m) => (
              <li key={`${m.project_id}-${m.user_id}`}>
                Membro {m.user_name ?? "—"} em {m.project_name}: custo/h {m.cost_rate_hour ?? "—"} ·
                venda/h {m.bill_rate_hour ?? "—"} (moeda não registrada)
              </li>
            ))}
            {(legacy.data?.allocations ?? []).map((a) => (
              <li key={a.allocation_id}>
                Alocação de {a.person_name}: custo {a.cost_rate ?? "—"} · venda{" "}
                {a.billable_rate ?? "—"} {a.currency} (unidade não registrada) desde{" "}
                {br(a.starts_at)}
              </li>
            ))}
            {(legacy.data?.project_members ?? []).length +
              (legacy.data?.allocations ?? []).length ===
              0 && (
              <li className="text-muted-foreground">Nenhum valor legado de membro ou alocação.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
