import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { FormSection } from "@/components/techhire/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import {
  closeProvision,
  getEconomics,
  moveEconomicPlan,
  previewProvision,
  saveEconomicPlan,
} from "./economics.functions";
import {
  econComponentLabel,
  econComponentsProblem,
  econIssueLabel,
  econModalityLabel,
  econMonthLabel,
  econMonths,
  econProrationLabel,
  econStatusLabel,
  money,
  type EconComponent,
  type EconComponentType,
  type EconContext,
  type EconModality,
  type EconPreview,
  type EconProration,
} from "./economics-types";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";

const ALL = "__all__";
export function useEconomics(kind: RequestKind, row: PreparationRow) {
  const p = usePermissions(),
    view = useSharedAction(resourceFor(kind), "view"),
    get = useServerFn(getEconomics);
  const q = useQuery({
    queryKey: ["hiring-economics", p.workspaceId, row.id, row.revision],
    enabled: view,
    queryFn: () => get({ data: { kind, id: row.id } }) as Promise<EconContext>,
    retry: false,
  });
  return { view, q };
}
const refresh = (qc: ReturnType<typeof useQueryClient>) =>
  void qc.invalidateQueries({ queryKey: ["hiring-economics"] });
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Falha inesperada.");

/** Lateral actions: economic plan versions, Finance decision and management provision. */
export function EconomicsPanel({ kind, row }: { kind: RequestKind; row: PreparationRow }) {
  const { view, q } = useEconomics(kind, row);
  if (!view || !q.data?.started) return null;
  const c = q.data;
  if (!c.can_view)
    return (
      <FormSection title="Plano econômico e provisão">
        <p className="text-sm text-muted-foreground">
          Valores e cálculo exigem permissão específica do plano econômico e acesso ao contrato
          {kind === "professional" ? " e à pessoa" : ""}.
        </p>
      </FormSection>
    );
  return (
    <FormSection title="Plano econômico e provisão">
      <p className="text-xs text-muted-foreground">
        Previsão gerencial: não gera título, conta a pagar, recorrência nem pagamento. O valor de
        referência da demanda não é usado como preço.
      </p>
      {c.proof_problem && (
        <p role="status" className="text-sm text-destructive">
          {c.proof_problem}
        </p>
      )}
      {!c.finance_configured && (
        <p role="status" className="text-sm text-muted-foreground">
          Pendência: configure o responsável Financeiro nas configurações contratuais.
        </p>
      )}
      {c.can_manage && !c.proof_problem && <PlanEditor kind={kind} row={row} ctx={c} />}
      {c.plan && <PlanMove kind={kind} row={row} ctx={c} />}
      {(c.can_preview || c.can_close) && c.plan?.status === "approved" && !c.proof_problem && (
        <ProvisionBox kind={kind} row={row} ctx={c} />
      )}
    </FormSection>
  );
}

function blank(type: EconComponentType): EconComponent {
  return {
    type,
    amount: 0,
    source_clause: "",
    due_days: 10,
    ...(type === "monthly" ? { proration: "calendar_days" as EconProration } : {}),
  };
}

function PlanEditor({
  kind,
  row,
  ctx,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: EconContext;
}) {
  const qc = useQueryClient(),
    act = useServerFn(saveEconomicPlan);
  const cur = ctx.versions.at(-1);
  const [modality, setModality] = useState<EconModality | "">(cur?.modality ?? ""),
    [currency, setCurrency] = useState(cur?.currency ?? "BRL"),
    [from, setFrom] = useState(cur?.effective_from ?? ctx.period?.starts_at ?? ""),
    [to, setTo] = useState(cur?.effective_to ?? ""),
    [source, setSource] = useState(cur?.source_reference ?? ""),
    [list, setList] = useState<EconComponent[]>(
      cur?.components.map(({ delivery_hash: _h, ...x }) => x) ?? [],
    ),
    [reason, setReason] = useState(""),
    [operation, setOperation] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () =>
      act({
        data: {
          kind,
          id: row.id,
          planId: ctx.plan?.id ?? null,
          version: ctx.plan?.version ?? null,
          modality: modality as EconModality,
          currency,
          effectiveFrom: from,
          effectiveTo: to || null,
          components: list,
          sourceReference: source,
          reason: ctx.plan ? reason : null,
          operation,
        },
      }),
    onSuccess: () => {
      setOperation(crypto.randomUUID());
      setReason("");
      refresh(qc);
    },
  });
  const problem = modality ? econComponentsProblem(modality, list) : "Escolha a modalidade.";
  const invalidRow = list.some((x) => !(x.amount > 0) || x.source_clause.trim().length < 5);
  const valid =
    !problem &&
    !invalidRow &&
    /^[A-Z]{3}$/.test(currency) &&
    !!from &&
    source.trim().length >= 5 &&
    (!ctx.plan || reason.trim().length >= 5);
  const types: EconComponentType[] =
    kind === "supplier" ? ["delivery", "monthly"] : ["delivery", "hourly", "monthly"];
  const set = (i: number, patch: Partial<EconComponent>) =>
    setList((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const p = `econ-${row.id}`;
  const dis = m.isPending;
  return (
    <fieldset className="space-y-2 border-t pt-3" aria-label="Plano econômico">
      <legend className="font-medium">
        {ctx.plan ? `Nova versão do plano (atual v${ctx.plan.version})` : "Montar plano econômico"}
      </legend>
      <Label htmlFor={`${p}-modality`}>Modalidade (escolha explícita)</Label>
      <Select value={modality} onValueChange={(v) => setModality(v as EconModality)} disabled={dis}>
        <SelectTrigger id={`${p}-modality`}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(econModalityLabel) as EconModality[])
            .filter((k) => kind === "professional" || k !== "hourly")
            .map((k) => (
              <SelectItem key={k} value={k}>
                {econModalityLabel[k]}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${p}-currency`}>Moeda</Label>
      <Input
        id={`${p}-currency`}
        value={currency}
        maxLength={3}
        disabled={dis}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
      />
      <Label htmlFor={`${p}-from`}>Vigência — início</Label>
      <IsoDatePicker
        id={`${p}-from`}
        value={from}
        min={ctx.period?.starts_at}
        max={ctx.period?.ends_at ?? undefined}
        disabled={dis}
        onChange={(v) => setFrom(v ?? "")}
      />
      <Label htmlFor={`${p}-to`}>Vigência — fim (opcional)</Label>
      <IsoDatePicker
        id={`${p}-to`}
        value={to}
        min={from || ctx.period?.starts_at}
        max={ctx.period?.ends_at ?? undefined}
        disabled={dis}
        onChange={(v) => setTo(v ?? "")}
      />
      <Label htmlFor={`${p}-source`}>Cláusula/seção conferida no instrumento assinado</Label>
      <Input
        id={`${p}-source`}
        value={source}
        maxLength={500}
        disabled={dis}
        onChange={(e) => setSource(e.target.value)}
      />
      <ol className="space-y-3">
        {list.map((x, i) => (
          <li key={i} className="space-y-1 rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{econComponentLabel[x.type]}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={dis}
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}
              >
                Remover
              </Button>
            </div>
            <Label htmlFor={`${p}-${i}-amount`}>
              {x.type === "hourly"
                ? "Valor por hora"
                : x.type === "monthly"
                  ? "Valor mensal"
                  : "Preço fechado"}
            </Label>
            <Input
              id={`${p}-${i}-amount`}
              inputMode="decimal"
              value={x.amount ? String(x.amount) : ""}
              disabled={dis}
              onChange={(e) => set(i, { amount: Number(e.target.value.replace(",", ".")) || 0 })}
            />
            <Label htmlFor={`${p}-${i}-clause`}>Fonte/cláusula deste componente</Label>
            <Input
              id={`${p}-${i}-clause`}
              value={x.source_clause}
              maxLength={500}
              disabled={dis}
              onChange={(e) => set(i, { source_clause: e.target.value })}
            />
            <Label htmlFor={`${p}-${i}-due`}>Vencimento (dias após a competência/aceite)</Label>
            <Input
              id={`${p}-${i}-due`}
              inputMode="numeric"
              value={String(x.due_days)}
              disabled={dis}
              onChange={(e) =>
                set(i, { due_days: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })
              }
            />
            {x.type === "monthly" && (
              <>
                <Label htmlFor={`${p}-${i}-pro`}>Regra do mês parcial</Label>
                <Select
                  value={x.proration}
                  onValueChange={(v) => set(i, { proration: v as EconProration })}
                  disabled={dis}
                >
                  <SelectTrigger id={`${p}-${i}-pro`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(econProrationLabel) as EconProration[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {econProrationLabel[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {x.type === "delivery" && (
              <>
                <Label htmlFor={`${p}-${i}-delivery`}>Entrega (versão atual)</Label>
                <Select
                  value={x.delivery_id ?? ""}
                  onValueChange={(v) => {
                    const d = ctx.deliveries.find((y) => y.id === v);
                    set(i, { delivery_id: v, delivery_version: d?.version });
                  }}
                  disabled={dis}
                >
                  <SelectTrigger id={`${p}-${i}-delivery`}>
                    <SelectValue placeholder="Selecione a entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {ctx.deliveries.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {(d.title ?? "Entrega") + ` — v${d.version}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {x.type === "hourly" && (
              <>
                <Label htmlFor={`${p}-${i}-project`}>Projeto das horas</Label>
                <Select
                  value={x.project_id ?? ALL}
                  onValueChange={(v) => set(i, { project_id: v === ALL ? undefined : v })}
                  disabled={dis}
                >
                  <SelectTrigger id={`${p}-${i}-project`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as alocações deste vínculo</SelectItem>
                    {ctx.projects.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant="outline"
            disabled={dis || list.length >= 20 || (t === "delivery" && ctx.deliveries.length === 0)}
            onClick={() => setList((l) => [...l, blank(t)])}
          >
            + {econComponentLabel[t]}
          </Button>
        ))}
      </div>
      {ctx.plan && (
        <>
          <Label htmlFor={`${p}-reason`}>Justificativa da nova versão</Label>
          <Textarea
            id={`${p}-reason`}
            value={reason}
            maxLength={2000}
            disabled={dis}
            onChange={(e) => setReason(e.target.value)}
          />
        </>
      )}
      {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
      <Button type="button" disabled={!valid || dis} onClick={() => m.mutate()}>
        {ctx.plan ? "Salvar nova versão" : "Salvar plano"}
      </Button>
      {m.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(m.error)}
        </p>
      )}
    </fieldset>
  );
}

function PlanMove({
  kind,
  row,
  ctx,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: EconContext;
}) {
  const qc = useQueryClient(),
    act = useServerFn(moveEconomicPlan);
  const [reason, setReason] = useState("");
  const cur = ctx.versions.at(-1);
  const m = useMutation({
    mutationFn: (action: "submitted" | "approved" | "rejected") =>
      act({
        data: {
          kind,
          id: row.id,
          planId: ctx.plan!.id,
          version: ctx.plan!.version,
          hash: cur!.content_hash,
          action,
          reason,
          operation: crypto.randomUUID(),
        },
      }),
    onSuccess: () => {
      setReason("");
      refresh(qc);
    },
  });
  if (!ctx.plan || !cur) return null;
  const canSubmit = ctx.can_manage && ctx.plan.status === "draft" && !ctx.proof_problem;
  if (!canSubmit && !ctx.can_decide)
    return (
      <p className="text-sm text-muted-foreground">
        Plano v{ctx.plan.version}: {econStatusLabel[ctx.plan.status]}
        {ctx.plan.status === "in_review" && ctx.finance_name
          ? ` — aguarda ${ctx.finance_name}`
          : ""}
      </p>
    );
  const id = `econ-move-${row.id}`;
  const ok = reason.trim().length >= 5 && !m.isPending;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm">
        Plano v{ctx.plan.version}: {econStatusLabel[ctx.plan.status]}
      </p>
      <Label htmlFor={id}>
        {ctx.can_decide ? "Motivo da decisão do Financeiro" : "Observação do envio"}
      </Label>
      <Textarea
        id={id}
        value={reason}
        maxLength={2000}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Button type="button" disabled={!ok} onClick={() => m.mutate("submitted")}>
            Enviar ao Financeiro
          </Button>
        )}
        {ctx.can_decide && (
          <>
            <Button type="button" disabled={!ok} onClick={() => m.mutate("approved")}>
              Aprovar versão
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ok}
              onClick={() => m.mutate("rejected")}
            >
              Rejeitar
            </Button>
          </>
        )}
      </div>
      {m.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(m.error)}
        </p>
      )}
    </div>
  );
}

function ProvisionBox({
  kind,
  row,
  ctx,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: EconContext;
}) {
  const qc = useQueryClient(),
    pv = useServerFn(previewProvision),
    cl = useServerFn(closeProvision);
  const months = econMonths();
  const [month, setMonth] = useState(months[1] ?? months[0]),
    [reason, setReason] = useState(""),
    [data, setData] = useState<EconPreview | null>(null);
  const prev = useMutation({
    mutationFn: () => pv({ data: { kind, id: row.id, month } }) as Promise<EconPreview>,
    onSuccess: setData,
  });
  const latest = ctx.provisions.find((x) => x.period_from === month);
  const close = useMutation({
    mutationFn: () =>
      cl({
        data: { kind, id: row.id, month, hash: data!.hash, previousId: latest?.id ?? null, reason },
      }),
    onSuccess: () => {
      setReason("");
      setData(null);
      refresh(qc);
    },
  });
  const ended = month < months[0];
  const id = `econ-prov-${row.id}`;
  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={`${id}-month`}>Competência</Label>
      <Select
        value={month}
        onValueChange={(v) => {
          setMonth(v);
          setData(null);
        }}
      >
        <SelectTrigger id={`${id}-month`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {econMonthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {ctx.can_preview && (
        <Button
          type="button"
          variant="outline"
          disabled={prev.isPending}
          onClick={() => prev.mutate()}
        >
          Calcular prévia
        </Button>
      )}
      {prev.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(prev.error)}
        </p>
      )}
      {data && (
        <div className="space-y-1 text-sm" aria-live="polite">
          <ul className="space-y-1">
            {data.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {econComponentLabel[l.type]}
                  {l.type === "hourly" && l.seconds !== undefined
                    ? ` — ${(l.seconds / 3600).toLocaleString("pt-BR")} h aprovadas e fechadas`
                    : ""}
                  {l.type === "monthly" && l.days ? ` — ${l.days}/${l.month_days} dias` : ""}
                  {l.issue ? ` — ${econIssueLabel[l.issue] ?? l.issue}` : ""}
                </span>
                <span>{money(l.amount, data.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="font-medium">
            Previsto conhecido: {money(data.totals.known, data.currency)}
          </p>
          <p className="text-xs text-muted-foreground">{data.notice}</p>
        </div>
      )}
      {data && ctx.can_close && ended && (
        <>
          <Label htmlFor={`${id}-reason`}>
            {latest
              ? `Justificativa da revisão ${latest.revision + 1}`
              : "Justificativa do fechamento"}
          </Label>
          <Textarea
            id={`${id}-reason`}
            value={reason}
            maxLength={2000}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            type="button"
            disabled={reason.trim().length < 10 || close.isPending || data.totals.unknown_lines > 0}
            onClick={() => close.mutate()}
          >
            {latest ? "Registrar revisão da provisão" : "Fechar provisão da competência"}
          </Button>
        </>
      )}
      {data && !ended && (
        <p className="text-xs text-muted-foreground">Competência em curso: apenas prévia.</p>
      )}
      {close.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(close.error)}
        </p>
      )}
    </div>
  );
}
