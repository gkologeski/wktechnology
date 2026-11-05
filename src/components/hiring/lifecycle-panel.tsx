import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  loadLifecycle,
  previewLifecycle,
  requestLifecycle,
  decideLifecycle,
  executeLifecycle,
} from "@/lib/hiring/lifecycle.functions";
import type { LifecycleInput, LifecycleKind, LifecyclePreview } from "@/lib/hiring/lifecycle.types";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const names: Record<LifecycleKind, string> = {
  renew: "Renovação",
  replace: "Substituição",
  end_allocation: "Encerrar alocação",
  end_employment: "Encerrar vínculo",
};
const statuses: Record<string, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  executed: "Executado",
};
export function LifecyclePanel({ engagementId }: { engagementId: string }) {
  const { can } = usePermissions();
  const load = useServerFn(loadLifecycle),
    previewFn = useServerFn(previewLifecycle),
    request = useServerFn(requestLifecycle),
    decide = useServerFn(decideLifecycle),
    execute = useServerFn(executeLifecycle);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["hiring-lifecycle", engagementId],
    queryFn: () => load({ data: { engagementId } }),
    enabled: can("techpeople.lifecycle.view.workspace"),
    retry: false,
  });
  const [input, setInput] = useState<LifecycleInput>({
    engagementId,
    allocationId: null,
    kind: "renew",
    effectiveDate: "",
    startsAt: null,
    endsAt: null,
    replacementId: null,
    overlap: false,
    reason: "",
  });
  const [preview, setPreview] = useState<LifecyclePreview | null>(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const change = (patch: Partial<LifecycleInput>) => {
    setInput((old) => ({ ...old, ...patch }));
    setPreview(null);
    setReviewed(false);
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["hiring-lifecycle"] }),
        qc.invalidateQueries({ queryKey: ["hiring-employment"] }),
        qc.invalidateQueries({ queryKey: ["person-allocations"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };
  if (!can("techpeople.lifecycle.view.workspace")) return null;
  if (query.isLoading) return <p aria-live="polite">Conferindo ciclo de alocação…</p>;
  if (query.error)
    return (
      <div role="alert">
        <p className="text-destructive">{query.error.message}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = query.data;
  if (!data) return null;
  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="font-medium">Ciclo de alocação e vínculo</h4>
      {!data.enabled ? (
        <p className="text-sm text-muted-foreground">
          Ciclo governado desativado neste workspace. Nenhuma operação será executada por este
          painel.
        </p>
      ) : (
        <>
          <Label>Operação</Label>
          <Select
            value={input.kind}
            onValueChange={(v) => {
              if (v in names)
                change({
                  kind: v as LifecycleKind,
                  allocationId: null,
                  replacementId: null,
                  overlap: false,
                });
            }}
          >
            <SelectTrigger aria-label="Operação do ciclo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(names)
                .filter(([k]) => can(`techpeople.lifecycle.${k}.workspace`))
                .map(([k, n]) => (
                  <SelectItem key={k} value={k}>
                    {n}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {input.kind !== "end_employment" && (
            <>
              <Label>Alocação de origem</Label>
              <Select
                value={input.allocationId ?? "vinculo"}
                onValueChange={(v) => change({ allocationId: v === "vinculo" ? null : v })}
              >
                <SelectTrigger aria-label="Alocação de origem">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {input.kind === "renew" && (
                    <SelectItem value="vinculo">Renovar apenas período do vínculo</SelectItem>
                  )}
                  {data.allocations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.project_name} · {a.starts_at} → {a.ends_at ?? "Indeterminado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Label>Data efetiva inclusiva do corte / fim anterior</Label>
          <IsoDatePicker
            ariaLabel="Data efetiva inclusiva"
            value={input.effectiveDate || null}
            onChange={(v) => change({ effectiveDate: v ?? "" })}
          />
          {(input.kind === "renew" || input.kind === "replace") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Novo início</Label>
                <IsoDatePicker
                  ariaLabel="Novo início"
                  value={input.startsAt}
                  onChange={(v) => change({ startsAt: v })}
                />
              </div>
              <div>
                <Label>Novo fim</Label>
                <IsoDatePicker
                  ariaLabel="Novo fim"
                  value={input.endsAt}
                  onChange={(v) => change({ endsAt: v })}
                />
              </div>
            </div>
          )}
          {input.kind === "replace" && (
            <>
              <Label>Substituto já admitido</Label>
              <Select
                value={input.replacementId ?? undefined}
                onValueChange={(v) => change({ replacementId: v })}
              >
                <SelectTrigger aria-label="Substituto admitido">
                  <SelectValue placeholder="Selecione vínculo existente" />
                </SelectTrigger>
                <SelectContent>
                  {data.replacements.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {r.starts_at} → {r.ends_at ?? "Indeterminado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex gap-2 items-center">
                <Checkbox
                  checked={input.overlap}
                  onCheckedChange={(v) => change({ overlap: v === true })}
                />
                Solicitar sobreposição explícita dos períodos
              </label>
            </>
          )}
          <Label htmlFor={`lifecycle-reason-${engagementId}`}>Justificativa</Label>
          <Textarea
            id={`lifecycle-reason-${engagementId}`}
            value={input.reason}
            onChange={(e) => change({ reason: e.target.value })}
            maxLength={2000}
          />
          <Button
            variant="outline"
            disabled={
              busy ||
              !input.effectiveDate ||
              input.reason.trim().length < 10 ||
              !can(`techpeople.lifecycle.${input.kind}.workspace`)
            }
            onClick={() => run(async () => setPreview(await previewFn({ data: input })))}
          >
            Calcular prévia
          </Button>
          {preview && (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm">
                Prévia da revisão {preview.revision} · política {preview.policy_revision}. Aprovação
                obrigatória: gestor da área → CEO. Histórico e outros acessos preservados.
              </p>
              <p className="text-sm text-muted-foreground">{preview.financial_review}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Alocações afetadas</dt>
                  <dd>{preview.effects.allocation_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Corte inclusivo</dt>
                  <dd>{preview.effects.effective_date}</dd>
                </div>
                {preview.effects.new_start && (
                  <div>
                    <dt className="text-muted-foreground">Novo período</dt>
                    <dd>
                      {preview.effects.new_start} → {preview.effects.new_end}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Sobreposição</dt>
                  <dd>
                    {preview.effects.overlap ? "Solicitada explicitamente" : "Sem sobreposição"}
                  </dd>
                </div>
              </dl>
              <label className="flex gap-2 items-center">
                <Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} />
                Conferi origem, documentos, datas e efeitos.
              </label>
              <Button
                disabled={busy || !reviewed || !can(`techpeople.lifecycle.${input.kind}.workspace`)}
                onClick={() =>
                  run(async () => {
                    await request({ data: { ...input, hash: preview.hash } });
                    setPreview(null);
                    toast.success("Solicitação encaminhada à aprovação, sem executar efeitos.");
                  })
                }
              >
                Solicitar aprovação
              </Button>
            </div>
          )}
        </>
      )}
      <h5 className="font-medium">Solicitações e decisões</h5>
      {!data.requests.length && (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação de ciclo registrada.</p>
      )}
      {data.requests.map((r) => (
        <section key={r.id} className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium">
            {names[r.kind]} · {statuses[r.status] ?? r.status} · corte {r.effective_date}
          </p>
          <p className="text-sm">{r.reason}</p>
          {r.steps.map((s) => (
            <p key={s.stage} className="text-xs text-muted-foreground">
              {s.stage === "manager" ? "Gestor da área" : "CEO"}: {statuses[s.status] ?? s.status}
              {s.note ? ` · ${s.note}` : ""}
            </p>
          ))}
          {data.enabled &&
            r.status === "pending" &&
            r.next_approver === data.actor_id &&
            r.requested_by !== data.actor_id &&
            can("techpeople.lifecycle.approve.workspace") && (
              <>
                <Label htmlFor={`decision-${r.id}`}>Justificativa da decisão</Label>
                <Textarea
                  id={`decision-${r.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || note.trim().length < 5}
                    onClick={() =>
                      run(() =>
                        decide({
                          data: {
                            requestId: r.id,
                            revision: r.revision,
                            decision: "approved",
                            note,
                          },
                        }),
                      )
                    }
                  >
                    Aprovar etapa
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || note.trim().length < 5}
                    onClick={() =>
                      run(() =>
                        decide({
                          data: {
                            requestId: r.id,
                            revision: r.revision,
                            decision: "rejected",
                            note,
                          },
                        }),
                      )
                    }
                  >
                    Rejeitar
                  </Button>
                </div>
              </>
            )}
          {data.enabled &&
            r.status === "approved" &&
            can("techpeople.lifecycle.execute.workspace") && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await execute({ data: { requestId: r.id, revision: r.revision } });
                    toast.success("Ciclo aprovado executado. Financeiro preservado.");
                  })
                }
              >
                Executar aprovação
              </Button>
            )}
        </section>
      ))}
    </div>
  );
}
