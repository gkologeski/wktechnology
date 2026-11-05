import { LifecycleReview } from "./lifecycle-review";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getLifecycleContext,
  previewLifecycle,
  requestLifecycle,
  decideLifecycle,
  applyLifecycle,
  type LifecycleChange,
  type LifecycleSnapshot,
} from "@/lib/hiring/lifecycle.functions";
const labels = {
  renew: "Renovar período",
  replace: "Substituir profissional",
  end_allocation: "Encerrar alocação",
  end_engagement: "Encerrar vínculo",
  cancel_commitments: "Revisar compromissos futuros",
};
const statuses: Record<string, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado para execução",
  rejected: "Reprovado",
  applied: "Executado",
};
export function LifecyclePanel({ engagementId }: { engagementId: string }) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState<LifecycleChange["kind"]>("end_allocation"),
    [allocation, setAllocation] = useState(""),
    [replacement, setReplacement] = useState(""),
    [search, setSearch] = useState(""),
    [date, setDate] = useState<string | null>(null),
    [start, setStart] = useState<string | null>(null),
    [end, setEnd] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [overlap, setOverlap] = useState(false),
    [entries, setEntries] = useState<Set<string>>(new Set()),
    [snapshot, setSnapshot] = useState<LifecycleSnapshot | null>(null),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [decision, setDecision] = useState(""),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const get = useServerFn(getLifecycleContext),
    preview = useServerFn(previewLifecycle),
    request = useServerFn(requestLifecycle),
    decide = useServerFn(decideLifecycle),
    apply = useServerFn(applyLifecycle),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["hiring-lifecycle", engagementId, search],
    queryFn: () => get({ data: { engagementId, search } }),
    enabled: open && can("techpeople.lifecycle.view.workspace"),
    retry: false,
  });
  const writable = can("techpeople.lifecycle.manage.workspace"),
    approver = can("techpeople.lifecycle.approve.workspace");
  const clear = () => {
    setSnapshot(null);
    setReviewed(false);
    setRequestId(crypto.randomUUID());
  };
  const data = (): LifecycleChange => {
    if (!date) throw Error("Informe a data efetiva.");
    return {
      engagementId,
      kind,
      payload: {
        date,
        reason,
        ...(["renew", "replace", "end_allocation"].includes(kind) ? { allocation } : {}),
        ...(kind === "renew" ? { end: end ?? undefined } : {}),
        ...(kind === "replace"
          ? { replacement, start: start ?? undefined, end: end ?? undefined, overlap }
          : {}),
        ...(kind === "cancel_commitments" ? { entries: [...entries] } : {}),
      },
    };
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["hiring-lifecycle", engagementId] });
      await qc.invalidateQueries({ queryKey: ["hiring-employment"] });
      toast.success("Operação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };
  if (!can("techpeople.lifecycle.view.workspace"))
    return (
      <p className="text-sm text-muted-foreground">
        Alterações de vigência exigem permissão de ciclo de vida.
      </p>
    );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Renovação, substituição e encerramento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ciclo de vida do vínculo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A prévia não executa alterações. O gestor da área e o CEO aprovam a mesma versão.
            Renovação exige documentos já revisados no TechContracts. Encerrar alocação não desliga
            a pessoa. Contratos, outros vínculos e acessos manuais são preservados.
          </p>
          {q.isError && (
            <p role="alert" className="text-destructive">
              {q.error.message}
            </p>
          )}
          {writable && (
            <fieldset disabled={busy} className="space-y-3 rounded-md border p-4">
              <Label>Operação</Label>
              <select
                className="block w-full rounded-md border bg-background p-2"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as LifecycleChange["kind"]);
                  clear();
                }}
              >
                {Object.entries(labels)
                  .filter(
                    ([k]) =>
                      k !== "cancel_commitments" ||
                      can("techfinance.entry_cancellation.manage.workspace"),
                  )
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
              </select>
              {["renew", "replace", "end_allocation"].includes(kind) && (
                <>
                  <Label>Alocação</Label>
                  <select
                    className="block w-full rounded-md border bg-background p-2"
                    value={allocation}
                    onChange={(e) => {
                      setAllocation(e.target.value);
                      clear();
                    }}
                  >
                    <option value="">Escolha a alocação</option>
                    {q.data?.allocations
                      .filter((a) => a.status !== "ended")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.starts_at} até {a.ends_at ?? "sem fim"} ·{" "}
                          {a.project_name ?? a.project_id ?? "Sem projeto"} · {a.id}
                        </option>
                      ))}
                  </select>
                </>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>
                    {kind === "renew" ? "Início da renovação" : "Data efetiva do corte"}
                  </Label>
                  <IsoDatePicker
                    ariaLabel="Data efetiva do ciclo de vida"
                    value={date}
                    onChange={(v) => {
                      setDate(v);
                      clear();
                    }}
                  />
                </div>
                {kind === "replace" && (
                  <div>
                    <Label>Início do substituto</Label>
                    <IsoDatePicker
                      ariaLabel="Início da substituição"
                      value={start}
                      onChange={(v) => {
                        setStart(v);
                        clear();
                      }}
                    />
                  </div>
                )}
                {["replace", "renew"].includes(kind) && (
                  <div>
                    <Label>Fim do novo período</Label>
                    <IsoDatePicker
                      ariaLabel="Fim do novo período"
                      value={end}
                      onChange={(v) => {
                        setEnd(v);
                        clear();
                      }}
                    />
                  </div>
                )}
              </div>
              {kind === "replace" && (
                <>
                  <Label>Profissional já admitido</Label>
                  <Input
                    value={search}
                    placeholder="Buscar profissional pelo nome"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    className="block w-full rounded-md border bg-background p-2"
                    value={replacement}
                    onChange={(e) => {
                      setReplacement(e.target.value);
                      clear();
                    }}
                  >
                    <option value="">Escolha o vínculo substituto</option>
                    {q.data?.replacements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={overlap}
                      onCheckedChange={(v) => {
                        setOverlap(v === true);
                        clear();
                      }}
                    />
                    Solicitar sobreposição explícita dos profissionais
                  </label>
                </>
              )}
              {kind === "cancel_commitments" && (
                <>
                  <p className="text-sm">
                    Selecione títulos para análise. Pagamentos, cobranças, medições e competência do
                    mês do corte ou anterior impedem cancelamento. O pedido usa a alçada Financeira.
                  </p>
                  {q.data?.commitments.map((f) => (
                    <label key={f.id} className="flex gap-2 text-sm">
                      <Checkbox
                        checked={entries.has(f.id)}
                        onCheckedChange={(on) => {
                          setEntries((old) => {
                            const next = new Set(old);
                            if (on) next.add(f.id);
                            else next.delete(f.id);
                            return next;
                          });
                          clear();
                        }}
                      />
                      {f.competence_date} · {f.currency} {Number(f.amount).toLocaleString("pt-BR")}{" "}
                      · {f.id}
                    </label>
                  ))}
                </>
              )}
              <Label>Justificativa</Label>
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  clear();
                }}
                maxLength={2000}
              />
              <Button
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  run(async () => {
                    setSnapshot(await preview({ data: data() }));
                    setReviewed(false);
                  })
                }
              >
                Conferir prévia
              </Button>
              {snapshot && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm">
                    Prévia conferida: {labels[kind]} · data {date}. A execução preserva períodos
                    anteriores, horas e outras origens. Alterações posteriores invalidam este
                    pedido.
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm">Dados da versão revisada</summary>
                    <LifecycleReview snapshot={snapshot} payload={data().payload} />
                  </details>
                  <label className="flex gap-2 text-sm">
                    <Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} />
                    Revisei a operação, a vigência e a justificativa.
                  </label>
                  <Button
                    disabled={!reviewed || busy}
                    onClick={() =>
                      run(async () => {
                        await request({ data: { ...data(), snapshot, requestId } });
                        clear();
                      })
                    }
                  >
                    Solicitar aprovação
                  </Button>
                </div>
              )}
            </fieldset>
          )}
          <h3 className="font-semibold">Solicitações e aprovações</h3>
          {approver && (
            <>
              <Label>Justificativa da decisão</Label>
              <Textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                maxLength={2000}
              />
            </>
          )}
          {q.data?.requests.map((r) => (
            <section key={r.id} className="space-y-2 rounded-md border p-3">
              <p className="font-medium">
                {labels[r.kind]} · {statuses[r.status] ?? r.status}
              </p>
              <p className="text-sm">
                Data: {r.payload.date} · {r.payload.reason}
              </p>
              <p className="text-xs text-muted-foreground">
                Gestor: {r.manager_at ? "Aprovado" : "Pendente"} · CEO:{" "}
                {r.ceo_at ? "Aprovado" : "Pendente"}
              </p>
              <details>
                <summary className="cursor-pointer text-sm">Revisar dados e versão</summary>
                <LifecycleReview snapshot={r.snapshot} payload={r.payload} />
              </details>
              <div className="flex flex-wrap gap-2">
                {r.status === "pending" && approver && (
                  <>
                    <Button
                      disabled={busy || decision.trim().length < 3}
                      onClick={() =>
                        run(() =>
                          decide({ data: { requestId: r.id, approve: true, reason: decision } }),
                        )
                      }
                    >
                      Aprovar minha etapa
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || decision.trim().length < 3}
                      onClick={() =>
                        run(() =>
                          decide({ data: { requestId: r.id, approve: false, reason: decision } }),
                        )
                      }
                    >
                      Reprovar
                    </Button>
                  </>
                )}
                {r.status === "approved" && writable && (
                  <Button
                    disabled={busy}
                    onClick={() => run(() => apply({ data: { requestId: r.id } }))}
                  >
                    Executar versão aprovada
                  </Button>
                )}
              </div>
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
