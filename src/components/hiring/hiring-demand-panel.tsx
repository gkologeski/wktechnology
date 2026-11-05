import { RecruitmentAuthorizationPanel } from "./recruitment-authorization-panel";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getHiringDemand,
  saveHiringDemand,
  requestHiringApproval,
  decideHiringApproval,
  saveHiringPolicy,
  type HiringContext,
} from "@/lib/hiring/hiring.functions";

const statuses: Record<string, string> = {
  not_requested: "Não solicitada",
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  superseded: "Substituída por nova revisão",
};
function Choice({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function HiringDemandPanel({
  jobId,
  onChanged,
}: {
  jobId: string;
  onChanged: () => Promise<void>;
}) {
  const load = useServerFn(getHiringDemand);
  const { data, error, isLoading } = useQuery({
    queryKey: ["hiring-demand", jobId],
    // Properties can invalidate a decision outside this tab; never reuse the global 1-minute freshness.
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: () => load({ data: { jobId } }),
    retry: false,
  });
  if (isLoading) return <p>Carregando demanda…</p>;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error.message}
      </p>
    );
  return data ? (
    <div className="space-y-4">
      <RecruitmentAuthorizationPanel jobId={jobId} onChanged={onChanged} />
      <DemandForm
        key={data.job.revision + ":" + data.job.status}
        data={data}
        onChanged={onChanged}
      />
    </div>
  ) : null;
}
function DemandForm({ data, onChanged }: { data: HiringContext; onChanged: () => Promise<void> }) {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const save = useServerFn(saveHiringDemand),
    request = useServerFn(requestHiringApproval),
    decide = useServerFn(decideHiringApproval),
    policy = useServerFn(saveHiringPolicy);
  const [purpose, setPurpose] = useState(
    data.job.purpose ?? (data.job.deal_id ? "client" : "internal"),
  );
  const [area, setArea] = useState(data.job.area_id ?? "");
  const [regime, setRegime] = useState(data.job.regime ?? "clt");
  const [billing, setBilling] = useState(
    data.job.billing ?? (data.job.deal_id ? "per_hour" : "not_applicable"),
  );
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [open, setOpen] = useState(false);
  const [manager, setManager] = useState(""),
    [ceo, setCeo] = useState(""),
    [md, setMd] = useState("none"),
    [cd, setCd] = useState("none");
  const allowed = (a: keyof HiringContext["capabilities"]) =>
    data.capabilities[a] &&
    can(
      a === "manage"
        ? "techhire.hiring_policies.manage.workspace"
        : `techhire.hiring_demands.${a === "request" ? "create" : a}.workspace`,
    );
  const dirty =
    purpose !== data.job.purpose ||
    area !== data.job.area_id ||
    regime !== data.job.regime ||
    billing !== data.job.billing;
  const name = (id: string) => data.members.find((m) => m.id === id)?.name ?? "Membro indisponível";
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["hiring-demand", data.job.id] });
      await onChanged();
      toast.success("Operação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  const pending = data.requests.find(
    (r) => r.status === "pending" && r.revision === data.job.revision,
  );
  const next = pending?.steps.find((s) => s.status === "pending");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Demanda e aprovações</CardTitle>
          <p className="text-sm text-muted-foreground">
            Revisão {data.job.revision} · {statuses[data.job.status] ?? data.job.status}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data.job.governed && (
            <p className="text-sm">
              Vaga histórica preservada. Salvar esta demanda a inclui no novo fluxo de aprovação.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Choice
              label="Finalidade"
              value={purpose}
              disabled={busy || !allowed("update")}
              onChange={(v) => {
                setPurpose(v as typeof purpose);
                setBilling(v === "client" ? "per_hour" : "not_applicable");
              }}
              options={[
                { id: "client", name: "Atendimento a cliente" },
                { id: "internal", name: "Time interno" },
                { id: "shared_management", name: "Gestão compartilhada" },
              ]}
            />
            <Choice
              label="Área responsável"
              value={area}
              disabled={busy || !allowed("update")}
              onChange={setArea}
              options={data.areas}
            />
            <Choice
              label="Vínculo profissional"
              value={regime}
              disabled={busy || !allowed("update")}
              onChange={(v) => setRegime(v as typeof regime)}
              options={[
                { id: "clt", name: "CLT" },
                { id: "pj", name: "PJ" },
                { id: "contract", name: "Freelance / Prestador" },
                { id: "internship", name: "Estágio" },
                { id: "temporary", name: "Temporário" },
              ]}
            />
            <Choice
              label="Modelo de cobrança do serviço"
              value={billing}
              disabled={busy || !allowed("update") || purpose !== "client"}
              onChange={(v) => setBilling(v as typeof billing)}
              options={Object.entries({
                not_applicable: "Não se aplica",
                per_hour: "Por hora",
                fixed_recurring: "Fixo recorrente",
                package: "Pacote",
                milestone: "Marco",
                success_fixed: "Sucesso (fixo)",
                success_percent: "Sucesso (%)",
                headcount_month: "Profissional / mês",
              }).map(([id, name]) => ({ id, name }))}
            />
          </div>
          {purpose === "client" && !data.job.deal_id && (
            <p role="alert">
              Vincule o negócio na ficha da vaga antes de salvar uma demanda de cliente.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Alterar a demanda exige nova aprovação. Esta etapa não autoriza recrutamento sem os
            demais requisitos contratuais nem gera admissão ou faturamento.
          </p>
          <div className="flex flex-wrap gap-2">
            {allowed("update") && (
              <Button
                disabled={busy || !area || !dirty || (purpose === "client" && !data.job.deal_id)}
                onClick={() =>
                  act(() =>
                    save({
                      data: {
                        jobId: data.job.id,
                        revision: data.job.revision,
                        purpose,
                        area,
                        regime,
                        billing,
                      },
                    }),
                  )
                }
              >
                Salvar demanda
              </Button>
            )}
            {allowed("request") && (
              <Button
                variant="outline"
                disabled={
                  busy ||
                  dirty ||
                  !data.job.governed ||
                  ["pending", "approved"].includes(data.job.status)
                }
                onClick={() =>
                  act(() => request({ data: { jobId: data.job.id, revision: data.job.revision } }))
                }
              >
                Solicitar aprovação
              </Button>
            )}
            {allowed("manage") && (
              <Button
                variant="outline"
                disabled={!area || busy}
                onClick={() => {
                  const p = data.policies.find((p) => p.area_id === area);
                  setManager(p?.manager_id ?? "");
                  setCeo(p?.ceo_id ?? "");
                  setMd(p?.manager_delegate_id ?? "none");
                  setCd(p?.ceo_delegate_id ?? "none");
                  setOpen(true);
                }}
              >
                Configurar alçada da área
              </Button>
            )}
          </div>
          {allowed("approve") &&
            pending &&
            next?.approver_id === data.actor_id &&
            pending.requested_by !== data.actor_id && (
              <div className="space-y-2 border-t pt-4">
                <Label>Justificativa da decisão</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                <div className="flex gap-2">
                  <Button
                    disabled={busy || dirty}
                    onClick={() =>
                      act(() =>
                        decide({ data: { requestId: pending.id, decision: "approved", note } }),
                      )
                    }
                  >
                    Aprovar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || note.trim().length < 5}
                    onClick={() =>
                      act(() =>
                        decide({ data: { requestId: pending.id, decision: "rejected", note } }),
                      )
                    }
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de decisões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.requests.length === 0 && <p>Nenhuma aprovação solicitada.</p>}
          {data.requests.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <p className="font-medium">
                Revisão {r.revision} · {statuses[r.status]}
              </p>
              {r.steps.map((s) => (
                <p key={s.id} className="mt-2 text-sm">
                  {s.stage === "manager" ? "Gestor" : "CEO"}: {name(s.approver_id)} ·{" "}
                  {statuses[s.status] ?? s.status}
                  {s.note ? ` — ${s.note}` : ""}
                </p>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
      {data.email_deliveries.some((d) => d.status === "failed" || d.status === "suppressed") && (
        <p role="status" className="text-sm">
          Há avisos por e-mail com falha ou supressão. A aprovação e a notificação interna continuam
          disponíveis; confira a configuração de e-mail.
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alçada · {data.areas.find((a) => a.id === area)?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            A mudança invalida aprovações anteriores desta área. O solicitante não pode aprovar sua
            própria demanda; configure substitutos.
          </p>
          <Choice label="Gestor" value={manager} onChange={setManager} options={data.members} />
          <Choice label="CEO" value={ceo} onChange={setCeo} options={data.members} />
          <Choice
            label="Substituto do gestor"
            value={md}
            onChange={setMd}
            options={[{ id: "none", name: "Sem substituto" }, ...data.members]}
          />
          <Choice
            label="Substituto do CEO"
            value={cd}
            onChange={setCd}
            options={[{ id: "none", name: "Sem substituto" }, ...data.members]}
          />
          <Button
            disabled={busy || !manager || !ceo}
            onClick={() =>
              act(async () => {
                await policy({
                  data: {
                    area,
                    manager,
                    ceo,
                    managerDelegate: md === "none" ? null : md,
                    ceoDelegate: cd === "none" ? null : cd,
                  },
                });
                setOpen(false);
              })
            }
          >
            Salvar alçada
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
