import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  decideClientAcceptance,
  generatePayables,
  getPayables,
  reconcilePayable,
  registerClientAcceptance,
} from "./payables.functions";
import {
  installmentsProblem,
  payBlockingLabel,
  payDocTypeLabel,
  payTargetLabel,
  selectedTotal,
  type PayContext,
} from "./payables-types";
import { econMonthLabel, econMonths, money } from "./economics-types";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";

const NONE = "__none__";
export function usePayables(kind: RequestKind, row: PreparationRow, month: string | null) {
  const p = usePermissions(),
    view = useSharedAction(resourceFor(kind), "view"),
    get = useServerFn(getPayables);
  const q = useQuery({
    queryKey: ["hiring-payables", p.workspaceId, row.id, row.revision, month],
    enabled: view,
    queryFn: () => get({ data: { kind, id: row.id, month } }) as Promise<PayContext>,
    retry: false,
  });
  return { view, q };
}
const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["hiring-payables"] });
  void qc.invalidateQueries({ queryKey: ["hiring-economics"] });
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Falha inesperada.");

/** Lateral actions: explicit selection → installments → canonical payable titles; reconciliation; client acceptance. */
export function PayablesPanel({ kind, row }: { kind: RequestKind; row: PreparationRow }) {
  const months = econMonths();
  const [month, setMonth] = useState(months[1] ?? months[0]);
  const { view, q } = usePayables(kind, row, month);
  if (!view || !q.data?.started) return null;
  const c = q.data;
  if (!c.can_view)
    return (
      <FormSection title="Contas a pagar">
        <p className="text-sm text-muted-foreground">
          Parcelas e títulos exigem permissão específica de contas a pagar, acesso a títulos do
          Financeiro e ao contrato{kind === "professional" ? " e à pessoa" : ""}.
        </p>
      </FormSection>
    );
  return (
    <FormSection title="Contas a pagar">
      <p className="text-xs text-muted-foreground">
        Gera títulos em aberto no Financeiro a partir de fontes elegíveis selecionadas. Nada é pago
        aqui: pagamentos são registrados no Financeiro. Fechar provisão não gera título.
      </p>
      {!c.finance_configured && (
        <p role="status" className="text-sm text-muted-foreground">
          Pendência: configure o responsável Financeiro nas configurações contratuais.
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor={`pay-month-${row.id}`}>Competência</Label>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger id={`pay-month-${row.id}`}>
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
      </div>
      {q.isFetching && <p className="text-sm text-muted-foreground">Calculando…</p>}
      {c.eligible_problem && (
        <p role="status" className="text-sm text-muted-foreground">
          {c.eligible_problem}
        </p>
      )}
      {c.legacy.length > 0 && <LegacyBox kind={kind} row={row} ctx={c} month={month} />}
      {c.eligible && c.can_generate && c.legacy.length === 0 && (
        <GenerateBox key={c.eligible.preview_hash} kind={kind} row={row} ctx={c} month={month} />
      )}
      {c.eligible && !c.can_generate && <LinesView ctx={c} />}
      {kind === "supplier" && c.release_condition === "also_client_acceptance" && (
        <ClientAcceptanceBox row={row} ctx={c} />
      )}
    </FormSection>
  );
}

function LinesView({
  ctx,
  keys,
  toggle,
}: {
  ctx: PayContext;
  keys?: string[];
  toggle?: (k: string) => void;
}) {
  const e = ctx.eligible!;
  if (!e.lines.length)
    return <p className="text-sm text-muted-foreground">Nenhuma fonte nesta competência.</p>;
  return (
    <ul className="space-y-2 text-sm" aria-label="Fontes elegíveis">
      {e.lines.map((l) => (
        <li key={l.key} className="flex items-start gap-2">
          {toggle && (
            <Checkbox
              id={`line-${l.key}`}
              checked={keys?.includes(l.key)}
              disabled={!!l.blocking || l.amount === null}
              onCheckedChange={() => toggle(l.key)}
              aria-label={`Selecionar ${l.source_clause}`}
            />
          )}
          <label htmlFor={`line-${l.key}`} className="space-y-0.5">
            <span className="block">
              {l.source_clause} · {money(l.amount, e.currency)}
              {l.type === "hourly" && l.seconds !== undefined
                ? ` · ${(l.seconds / 3600).toFixed(2)} h`
                : ""}
            </span>
            {l.blocking && (
              <span className="block text-xs text-muted-foreground">
                Pendência: {payBlockingLabel[l.blocking] ?? l.blocking}
              </span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

function GenerateBox({
  kind,
  row,
  ctx,
  month,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: PayContext;
  month: string;
}) {
  const qc = useQueryClient(),
    act = useServerFn(generatePayables);
  const e = ctx.eligible!;
  const [keys, setKeys] = useState<string[]>([]),
    [inst, setInst] = useState<Array<{ amount: number; due_on: string }>>([]),
    [doc, setDoc] = useState(NONE),
    [just, setJust] = useState(""),
    [operation, setOperation] = useState(() => crypto.randomUUID());
  const total = selectedTotal(e.lines, keys);
  const toggle = (k: string) => {
    const next = keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k];
    setKeys(next);
    const t = selectedTotal(e.lines, next);
    const due = e.lines.find((l) => next.includes(l.key))?.due_on ?? "";
    setInst(t ? [{ amount: t, due_on: due }] : []);
    setOperation(crypto.randomUUID());
  };
  const problem =
    total === null || !keys.length
      ? "Selecione ao menos uma fonte elegível."
      : (installmentsProblem(total, inst, month) ??
        (just.trim().length < 10 ? "Justifique a geração (mínimo 10 caracteres)." : null));
  const m = useMutation({
    mutationFn: () =>
      act({
        data: {
          kind,
          id: row.id,
          month,
          previewHash: e.preview_hash,
          keys,
          installments: inst,
          documentId: doc === NONE ? null : doc,
          justification: just,
          operation,
        },
      }),
    onSuccess: () => refresh(qc),
  });
  const p = `pay-${row.id}`;
  return (
    <div className="space-y-3">
      <LinesView ctx={ctx} keys={keys} toggle={toggle} />
      {total !== null && keys.length > 0 && (
        <p className="text-sm font-medium">Obrigação selecionada: {money(total, e.currency)}</p>
      )}
      {inst.map((x, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${p}-a${i}`}>Parcela {i + 1} — valor</Label>
            <Input
              id={`${p}-a${i}`}
              type="number"
              step="0.01"
              min="0.01"
              value={x.amount}
              onChange={(ev) =>
                setInst(
                  inst.map((y, j) => (j === i ? { ...y, amount: Number(ev.target.value) } : y)),
                )
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-d${i}`}>Vencimento</Label>
            <IsoDatePicker
              id={`${p}-d${i}`}
              value={x.due_on}
              min={month}
              onChange={(v) =>
                setInst(inst.map((y, j) => (j === i ? { ...y, due_on: v ?? "" } : y)))
              }
            />
          </div>
        </div>
      ))}
      {inst.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={inst.length >= 24}
            onClick={() => setInst([...inst, { amount: 0, due_on: inst.at(-1)?.due_on ?? "" }])}
          >
            Adicionar parcela
          </Button>
          {inst.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInst(inst.slice(0, -1))}
            >
              Remover última
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${p}-doc`}>
          {ctx.regime === "clt" ? "Evidência de folha conferida" : "Documento fiscal conferido"}
        </Label>
        <Select value={doc} onValueChange={setDoc}>
          <SelectTrigger id={`${p}-doc`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Selecione</SelectItem>
            {ctx.documents.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {payDocTypeLabel[d.doc_type] ?? d.doc_type} {d.number} · saldo{" "}
                {money(Number(d.amount) - Number(d.used), d.currency)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Conferência humana do Financeiro; não equivale a validação na SEFAZ.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${p}-just`}>Justificativa</Label>
        <Textarea
          id={`${p}-just`}
          value={just}
          onChange={(ev) => setJust(ev.target.value)}
          maxLength={2000}
        />
      </div>
      {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
      {m.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(m.error)}
        </p>
      )}
      <Button type="button" disabled={!!problem || m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? "Gerando…" : "Gerar contas a pagar"}
      </Button>
    </div>
  );
}

function LegacyBox({
  kind,
  row,
  ctx,
  month,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: PayContext;
  month: string;
}) {
  const qc = useQueryClient(),
    act = useServerFn(reconcilePayable);
  const [reason, setReason] = useState(""),
    [doc, setDoc] = useState(NONE),
    [keys, setKeys] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: (v: { target: string; decision: "linked" | "unrelated" }) =>
      act({
        data: {
          kind,
          id: row.id,
          month,
          targetId: v.target,
          decision: v.decision,
          previewHash: ctx.eligible?.preview_hash ?? null,
          keys: v.decision === "linked" ? keys : [],
          documentId: doc === NONE ? null : doc,
          reason,
          operation: crypto.randomUUID(),
        },
      }),
    onSuccess: () => refresh(qc),
  });
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p role="status" className="text-sm font-medium">
        Títulos ou recorrências existentes podem cobrir esta competência
      </p>
      <p className="text-xs text-muted-foreground">
        Nova despesa fica bloqueada até o Financeiro configurado vincular um título compatível ou
        declarar que não se relaciona. Nada é cancelado ou alterado.
      </p>
      <ul className="space-y-2 text-sm">
        {ctx.legacy.map((l) => (
          <li key={l.id} className="space-y-1">
            <span className="block">
              {l.kind === "recurrence" ? "Recorrência" : "Título"}: {l.description ?? "—"} ·{" "}
              {money(l.amount as number, l.currency ?? ctx.eligible?.currency ?? "BRL")}
              {l.status ? ` · ${l.status}` : ""}
            </span>
            {ctx.can_reconcile && (
              <span className="flex flex-wrap gap-2">
                {l.kind === "entry" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={m.isPending || reason.trim().length < 10 || !keys.length}
                    onClick={() => m.mutate({ target: l.id, decision: "linked" })}
                  >
                    Vincular às fontes selecionadas
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={m.isPending || reason.trim().length < 10}
                  onClick={() => m.mutate({ target: l.id, decision: "unrelated" })}
                >
                  Não se relaciona
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {ctx.can_reconcile && (
        <>
          {ctx.eligible && (
            <LinesView
              ctx={ctx}
              keys={keys}
              toggle={(k) => setKeys(keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k])}
            />
          )}
          <div className="space-y-1">
            <Label htmlFor={`recon-doc-${row.id}`}>Documento que lastreia o título</Label>
            <Select value={doc} onValueChange={setDoc}>
              <SelectTrigger id={`recon-doc-${row.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecione</SelectItem>
                {ctx.documents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {payDocTypeLabel[d.doc_type] ?? d.doc_type} {d.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`recon-reason-${row.id}`}>Justificativa da conciliação</Label>
            <Textarea
              id={`recon-reason-${row.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </div>
        </>
      )}
      {!ctx.can_reconcile && (
        <p className="text-xs text-muted-foreground">
          Pendência: somente o responsável Financeiro configurado
          {ctx.finance_name ? ` (${ctx.finance_name})` : ""} concilia.
        </p>
      )}
      {m.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(m.error)}
        </p>
      )}
    </div>
  );
}

function ClientAcceptanceBox({ row, ctx }: { row: PreparationRow; ctx: PayContext }) {
  const qc = useQueryClient(),
    reg = useServerFn(registerClientAcceptance),
    dec = useServerFn(decideClientAcceptance);
  const targets = Object.entries(ctx.client_targets ?? {}) as Array<
    [keyof typeof payTargetLabel, string]
  >;
  const [delivery, setDelivery] = useState(NONE),
    [target, setTarget] = useState<string>(targets[0]?.[0] ?? NONE),
    [name, setName] = useState(""),
    [role, setRole] = useState(""),
    [on, setOn] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState(""),
    [operation, setOperation] = useState(() => crypto.randomUUID());
  const d = ctx.acceptable_deliveries.find((x) => x.id === delivery);
  const tid = targets.find(([k]) => k === target)?.[1];
  const r = useMutation({
    mutationFn: () =>
      reg({
        data: {
          kind: "supplier",
          id: row.id,
          deliveryId: delivery,
          version: d!.version,
          hash: d!.hash,
          targetKind: target as keyof typeof payTargetLabel,
          targetId: tid!,
          name,
          role,
          acceptedOn: on,
          evidence,
          operation,
        },
      }),
    onSuccess: () => {
      setOperation(crypto.randomUUID());
      refresh(qc);
    },
  });
  const c = useMutation({
    mutationFn: (v: { id: string; hash: string; decision: "confirmed" | "rejected" }) =>
      dec({
        data: {
          kind: "supplier",
          id: row.id,
          acceptanceId: v.id,
          hash: v.hash,
          decision: v.decision,
          reason,
          operation: crypto.randomUUID(),
        },
      }),
    onSuccess: () => refresh(qc),
  });
  const p = `ca-${row.id}`;
  const pending = ctx.client_acceptances.filter((a) => a.status === "registered");
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Aceite do cliente final</p>
      <p className="text-xs text-muted-foreground">
        Condição especial: a entrega só gera conta a pagar após aceite técnico WK, aceite nomeado do
        cliente final conferido pelo Financeiro e documento fiscal conferido. Aceite técnico não
        substitui o do cliente.
      </p>
      {ctx.can_register_client && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`${p}-d`}>Entrega aceita pela WK</Label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger id={`${p}-d`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecione</SelectItem>
                {ctx.acceptable_deliveries.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.title} · v{x.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-t`}>Vínculo do cliente</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id={`${p}-t`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map(([k]) => (
                  <SelectItem key={k} value={k}>
                    {payTargetLabel[k]} da solicitação
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-n`}>Nome de quem aceitou</Label>
            <Input
              id={`${p}-n`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-r`}>Cargo</Label>
            <Input
              id={`${p}-r`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-o`}>Data do aceite</Label>
            <IsoDatePicker id={`${p}-o`} value={on} onChange={(v) => setOn(v ?? "")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}-e`}>Referência da evidência</Label>
            <Input
              id={`${p}-e`}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={500}
            />
          </div>
          {r.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(r.error)}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={
              !d ||
              !tid ||
              name.trim().length < 3 ||
              role.trim().length < 2 ||
              !on ||
              evidence.trim().length < 5 ||
              r.isPending
            }
            onClick={() => r.mutate()}
          >
            Registrar aceite do cliente
          </Button>
        </div>
      )}
      {ctx.can_confirm_client && pending.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${p}-why`}>Motivo da conferência</Label>
          <Textarea
            id={`${p}-why`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
          />
          {pending.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {a.accepted_by_name} ({a.accepted_by_role}) · {a.accepted_on}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={a.registered_by_me || reason.trim().length < 5 || c.isPending}
                onClick={() => c.mutate({ id: a.id, hash: a.content_hash, decision: "confirmed" })}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={a.registered_by_me || reason.trim().length < 5 || c.isPending}
                onClick={() => c.mutate({ id: a.id, hash: a.content_hash, decision: "rejected" })}
              >
                Rejeitar
              </Button>
            </div>
          ))}
          {c.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(c.error)}
            </p>
          )}
        </div>
      )}
      {!ctx.can_confirm_client && pending.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pendência: conferência pelo responsável Financeiro configurado.
        </p>
      )}
    </div>
  );
}

/** Center column: schedules with installment titles (link to Financeiro), reconciliations and client acceptances. */
export function PayablesHistory({ kind, row }: { kind: RequestKind; row: PreparationRow }) {
  const { view, q } = usePayables(kind, row, null);
  const c = q.data;
  if (!view || !c?.started || !c.can_view) return null;
  const when = (d: string) => new Date(d).toLocaleString("pt-BR");
  return (
    <FormSection title="Histórico de contas a pagar">
      {!c.schedules.length && !c.reconciliations.length && (
        <p className="text-sm text-muted-foreground">Nenhuma parcela gerada ou conciliada.</p>
      )}
      <ol className="space-y-4 text-sm">
        {c.schedules.map((s) => (
          <li key={s.id} className="space-y-1 border-b pb-3">
            <div className="flex flex-wrap gap-2">
              <span className="font-medium">{econMonthLabel(s.competence)}</span>
              <span>{money(s.total, s.currency)}</span>
              <span className="text-muted-foreground">
                plano v{s.plan_version} · {when(s.at)} · {s.by ?? "—"}
              </span>
            </div>
            <p className="text-muted-foreground">{s.justification}</p>
            <ul className="list-disc pl-5">
              {s.installments.map((n) => (
                <li key={n.seq}>
                  Parcela {n.seq}: {money(n.amount, s.currency)} · vence {n.due_on} ·{" "}
                  {n.status ?? "—"}
                  {Number(n.paid) > 0 ? ` · pago ${money(n.paid, s.currency)}` : ""} ·{" "}
                  <Link
                    to="/finance/entries/$id"
                    params={{ id: n.entry_id }}
                    className="underline underline-offset-2"
                  >
                    abrir título
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {c.reconciliations.length > 0 && (
        <ul className="space-y-1 text-sm">
          {c.reconciliations.map((r) => (
            <li key={r.id}>
              {r.decision === "linked" ? "Vinculado" : "Não relacionado"} ·{" "}
              {econMonthLabel(r.competence)} · {when(r.at)} · {r.by ?? "—"}: {r.reason}
              {r.entry_id && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    to="/finance/entries/$id"
                    params={{ id: r.entry_id }}
                    className="underline underline-offset-2"
                  >
                    abrir título
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {c.client_acceptances.length > 0 && (
        <ul className="space-y-1 text-sm">
          {c.client_acceptances.map((a) => (
            <li key={a.id}>
              Aceite do cliente ({payTargetLabel[a.target_kind]}) · {a.accepted_by_name} ·{" "}
              {a.accepted_on} ·{" "}
              {a.status === "confirmed"
                ? "conferido"
                : a.status === "rejected"
                  ? "rejeitado"
                  : "aguardando conferência"}
              {a.reason ? ` · ${a.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
