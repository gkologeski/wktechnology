import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  loadEmploymentContext,
  admitEmployment,
  linkEmploymentContract,
  allocateEmployment,
  endEmployment,
  prepareEmploymentInvite,
  changeEmploymentModel,
} from "@/lib/hiring/employment.functions";
import type { HiringEngagement } from "@/lib/hiring/employment.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function EmploymentPanel({
  personId,
  candidateId,
}: {
  personId?: string;
  candidateId?: string;
}) {
  const { can } = usePermissions();
  const load = useServerFn(loadEmploymentContext),
    admit = useServerFn(admitEmployment),
    contract = useServerFn(linkEmploymentContract),
    allocate = useServerFn(allocateEmployment),
    end = useServerFn(endEmployment),
    invite = useServerFn(prepareEmploymentInvite),
    changeModel = useServerFn(changeEmploymentModel);
  const qc = useQueryClient();
  const [lookupSearch, setLookupSearch] = useState("");
  const debouncedLookup = useDebouncedValue(lookupSearch, 250);
  const queryKey = ["hiring-employment", personId ?? "", candidateId ?? "", debouncedLookup];
  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      load({
        data: {
          personId: personId ?? null,
          candidateId: candidateId ?? null,
          search: debouncedLookup,
        },
      }),
    enabled: can("techpeople.employment.view.workspace"),
    retry: false,
    placeholderData: (previous) => previous,
    staleTime: 0,
  });
  const [application, setApplication] = useState(""),
    [model, setModel] = useState(""),
    [entity, setEntity] = useState(""),
    [person, setPerson] = useState("new"),
    [employment, setEmployment] = useState<"pj" | "clt" | "contractor" | "intern" | "other">("pj"),
    [start, setStart] = useState<string | null>(null),
    [hireDate, setHireDate] = useState<string | null>(null),
    [finish, setFinish] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<HiringEngagement | null>(null),
    [mode, setMode] = useState<"contract" | "allocate" | "end" | "model" | null>(null),
    [choice, setChoice] = useState(""),
    [pct, setPct] = useState("100"),
    [inviteUrl, setInviteUrl] = useState("");
  if (!can("techpeople.employment.view.workspace")) return null;
  const writable = can("techpeople.employment.manage.workspace");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["hiring-employment"] });
      await qc.invalidateQueries({ queryKey: ["people"] });
      toast.success("Operação concluída.");
      setMode(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };
  const open = (e: HiringEngagement, m: "contract" | "allocate" | "end" | "model") => {
    setModel("");
    setLookupSearch("");
    setTarget(e);
    setMode(m);
    setChoice("");
    setStart(e.starts_at);
    setFinish(e.ends_at);
    setReason("");
    setReviewed(false);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contratação integrada e acessos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Origem, entidade WK, vigência e versão do acesso por vínculo. Encerrar um vínculo preserva
          os demais e os acessos manuais.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p>Conferindo vínculos…</p>
        ) : error ? (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        ) : (
          <>
            {data?.engagements.length === 0 && (
              <p>Nenhum vínculo no novo fluxo. Cadastros históricos permanecem preservados.</p>
            )}
            {data?.engagements.map((e) => (
              <section key={e.id} className="border rounded-md p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">
                    {e.person_name} · {e.status === "active" ? "Vínculo ativo" : "Encerrado"}
                  </p>
                  <span className="text-sm">
                    {e.starts_at} → {e.ends_at ?? "Indeterminado"}
                  </span>
                </div>
                <p className="text-sm">
                  {e.model_name} ·{" "}
                  {e.purpose === "client"
                    ? "Atendimento a cliente"
                    : e.purpose === "internal"
                      ? "Time interno"
                      : "Gestão compartilhada"}{" "}
                  ·{" "}
                  {data.entities.find((x) => x.id === e.legal_entity_id)?.name ??
                    "Entidade registrada"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/people/$id" params={{ id: e.person_id }}>
                      Pessoa
                    </Link>
                  </Button>
                  {e.purchase_contract_id && (
                    <Button variant="outline" asChild>
                      <Link to="/contracts/$id" params={{ id: e.purchase_contract_id }}>
                        Contrato de compra
                      </Link>
                    </Button>
                  )}
                  {writable && e.status === "active" && (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy || !!e.purchase_contract_id}
                        onClick={() => open(e, "contract")}
                      >
                        Contrato de contratação
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || !e.purchase_contract_id}
                        onClick={() => open(e, "allocate")}
                      >
                        Alocar em projeto
                      </Button>
                      {can("system.roles.manage.workspace") && (
                        <Button variant="outline" disabled={busy} onClick={() => open(e, "model")}>
                          Revisar modelo de acesso
                        </Button>
                      )}
                      {can("system.roles.manage.workspace") && (
                        <Button
                          variant="outline"
                          disabled={busy || e.access_active}
                          onClick={() =>
                            run(async () => {
                              const token = await invite({ data: { engagementId: e.id } });
                              setInviteUrl(`${window.location.origin}/accept-employment/${token}`);
                            })
                          }
                        >
                          {e.access_active
                            ? "Acesso do vínculo aplicado"
                            : e.invite_pending
                              ? "Obter convite preparado"
                              : "Preparar convite de acesso"}
                        </Button>
                      )}
                      <Button variant="outline" disabled={busy} onClick={() => open(e, "end")}>
                        Encerrar este vínculo
                      </Button>
                    </>
                  )}
                </div>
              </section>
            ))}
            {inviteUrl && (
              <div className="rounded-md border p-4 space-y-2">
                <p>Convite preparado, sem envio automático. Entregue somente ao destinatário.</p>
                <Input aria-label="Link do convite de contratação" readOnly value={inviteUrl} />
              </div>
            )}
            {candidateId && writable && (
              <details className="border rounded-md p-4">
                <summary className="font-medium cursor-pointer">
                  Admitir ou reutilizar pessoa a partir da candidatura
                </summary>
                <div className="space-y-4 pt-4">
                  <p className="text-sm">
                    Requer desfecho Contratado, aprovação vigente e, para cliente, contrato
                    comercial assinado. Hunting segue contratação pelo cliente.
                  </p>
                  <Label>Candidatura</Label>
                  <Select
                    value={application || undefined}
                    onValueChange={(v) => {
                      setApplication(v);
                      const a = data?.applications.find((x) => x.id === v);
                      setEntity(a?.entity_id ?? "");
                      setHireDate(a?.hire_date ?? null);
                      setEmployment(
                        (
                          {
                            clt: "clt",
                            pj: "pj",
                            contract: "contractor",
                            internship: "intern",
                            temporary: "other",
                          } as const
                        )[
                          a?.employment as "clt" | "pj" | "contract" | "internship" | "temporary"
                        ] ?? "pj",
                      );
                      setStart(a?.starts_at ?? null);
                      setFinish(a?.ends_at ?? null);
                      setReviewed(false);
                    }}
                  >
                    <SelectTrigger aria-label="Candidatura da admissão">
                      <SelectValue placeholder="Selecione a candidatura" />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.applications.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.title} · {a.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {data?.applications.find((a) => a.id === application)?.reason && (
                    <p className="text-sm text-destructive">
                      {data.applications.find((a) => a.id === application)?.reason}
                    </p>
                  )}
                  <Label>Buscar pessoa existente (até 50 resultados)</Label>
                  <Input
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    placeholder="Digite o nome da pessoa…"
                  />
                  <Label>Pessoa</Label>
                  <Select value={person} onValueChange={setPerson}>
                    <SelectTrigger aria-label="Pessoa nova ou existente">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        Criar nova ou reutilizar já vinculada ao candidato
                      </SelectItem>
                      {data?.people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          Reutilizar: {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label>Regime da nova pessoa</Label>
                  <Select
                    value={employment}
                    onValueChange={(v) => setEmployment(v as typeof employment)}
                  >
                    <SelectTrigger aria-label="Regime profissional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        ["pj", "PJ"],
                        ["clt", "CLT"],
                        ["contractor", "Freelance / Prestador"],
                        ["intern", "Estágio"],
                        ["other", "Outro"],
                      ].map(([v, n]) => (
                        <SelectItem key={v} value={v}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label>Modelo de acesso do cargo</Label>
                  <Select value={model || undefined} onValueChange={setModel}>
                    <SelectTrigger aria-label="Modelo de acesso da admissão">
                      <SelectValue placeholder="Selecione modelo ativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!data?.models.length && (
                    <p className="text-sm">
                      Revise e ative um modelo em Configurações → Permissões.
                    </p>
                  )}
                  <Label>Entidade WK</Label>
                  <Select value={entity || undefined} onValueChange={setEntity}>
                    <SelectTrigger aria-label="Entidade WK da admissão">
                      <SelectValue placeholder="Selecione entidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.entities.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label>Data efetiva de admissão (nova pessoa)</Label>
                  <IsoDatePicker
                    ariaLabel="Data efetiva da admissão"
                    value={hireDate}
                    onChange={setHireDate}
                  />
                  <p className="text-xs text-muted-foreground">
                    A vigência comercial abaixo não substitui a data real de admissão. Pessoas
                    existentes preservam sua data.
                  </p>
                  <Label>Início</Label>
                  <IsoDatePicker ariaLabel="Início do vínculo" value={start} onChange={setStart} />
                  <Label>Fim</Label>
                  <IsoDatePicker ariaLabel="Fim do vínculo" value={finish} onChange={setFinish} />
                  <Label>Motivo de alteração do período herdado</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                  <label className="flex gap-2 items-center">
                    <Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} />{" "}
                    Conferi pessoa, origem, cargo, entidade e período.
                  </label>
                  <Button
                    disabled={busy || !reviewed || !application || !model || !entity || !start}
                    onClick={() =>
                      run(() =>
                        admit({
                          data: {
                            applicationId: application,
                            personId: person === "new" ? null : person,
                            modelId: model,
                            entityId: entity,
                            startsAt: start,
                            endsAt: finish,
                            reason,
                            employment,
                            hireDate,
                          },
                        }),
                      )
                    }
                  >
                    Registrar admissão / reutilização
                  </Button>
                </div>
              </details>
            )}
          </>
        )}
        <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {mode === "allocate"
                  ? "Alocar vínculo"
                  : mode === "contract"
                    ? "Contrato de contratação"
                    : mode === "model"
                      ? "Revisar modelo do vínculo"
                      : "Encerrar vínculo"}
              </DialogTitle>
            </DialogHeader>
            {target && (
              <div className="space-y-4">
                {(mode === "contract" || mode === "allocate") && (
                  <>
                    <Label>
                      Buscar {mode === "contract" ? "contrato" : "projeto"} (até 50 resultados)
                    </Label>
                    <Input
                      value={lookupSearch}
                      onChange={(e) => setLookupSearch(e.target.value)}
                      placeholder="Digite parte do nome…"
                    />
                  </>
                )}
                {mode === "contract" ? (
                  <>
                    <p>
                      Reutilize um contrato de compra da mesma pessoa e entidade WK ou crie um
                      rascunho para revisão. Não assina nem ativa automaticamente.
                    </p>
                    <Select value={choice || undefined} onValueChange={setChoice}>
                      <SelectTrigger aria-label="Contrato de compra existente">
                        <SelectValue placeholder="Criar contrato de compra em rascunho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Criar novo rascunho</SelectItem>
                        {data?.contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex gap-2">
                      <Checkbox
                        checked={reviewed}
                        onCheckedChange={(v) => setReviewed(v === true)}
                      />{" "}
                      Conferi que a contraparte é este profissional e a entidade é a WK correta.
                    </label>
                    <Button
                      disabled={busy || !reviewed}
                      onClick={() =>
                        run(() =>
                          contract({
                            data: {
                              engagementId: target.id,
                              contractId: !choice || choice === "new" ? null : choice,
                            },
                          }),
                        )
                      }
                    >
                      Vincular contrato / criar rascunho
                    </Button>
                  </>
                ) : mode === "allocate" ? (
                  <>
                    <p>
                      Datas herdadas do vínculo. Alterações dentro da vigência exigem motivo;
                      ampliação exige rever contrato e aprovação. O contrato de compra precisa estar
                      ativo.
                    </p>
                    <Select value={choice || undefined} onValueChange={setChoice}>
                      <SelectTrigger aria-label="Projeto da alocação">
                        <SelectValue placeholder="Selecione projeto existente" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Início</Label>
                    <IsoDatePicker
                      ariaLabel="Início da alocação integrada"
                      value={start}
                      onChange={setStart}
                    />
                    <Label>Fim</Label>
                    <IsoDatePicker
                      ariaLabel="Fim da alocação integrada"
                      value={finish}
                      onChange={setFinish}
                    />
                    <Label>
                      Dedicação (%)
                      <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
                    </Label>
                    <Label>
                      Justificativa
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Label>
                    <Button
                      disabled={busy || !choice || !start}
                      onClick={() =>
                        run(() =>
                          allocate({
                            data: {
                              engagementId: target.id,
                              projectId: choice,
                              startsAt: start,
                              endsAt: finish,
                              percent: Number(pct),
                              reason,
                            },
                          }),
                        )
                      }
                    >
                      Criar alocação
                    </Button>
                  </>
                ) : mode === "model" ? (
                  <>
                    <p>
                      A nova versão deve corresponder ao cargo aprovado na demanda. Apenas a
                      concessão deste vínculo será substituída; outras origens serão preservadas.
                    </p>
                    <Select value={model || undefined} onValueChange={setModel}>
                      <SelectTrigger aria-label="Novo modelo de acesso do vínculo">
                        <SelectValue placeholder="Selecione modelo ativo" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>
                      Motivo da revisão
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Label>
                    <Button
                      disabled={busy || !model || reason.trim().length < 10}
                      onClick={() =>
                        run(() =>
                          changeModel({
                            data: {
                              engagementId: target.id,
                              revision: target.revision,
                              modelId: model,
                              reason,
                            },
                          }),
                        )
                      }
                    >
                      Aplicar versão revisada
                    </Button>
                  </>
                ) : mode === "end" ? (
                  <>
                    <p>
                      Encerra as alocações e revoga somente o pacote criado por este vínculo. Não
                      desliga a pessoa da WK nem cancela contratos ou pagamentos.
                    </p>
                    <Label>
                      Motivo
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Label>
                    <Button
                      disabled={busy || reason.trim().length < 10}
                      onClick={() => run(() => end({ data: { engagementId: target.id, reason } }))}
                    >
                      Encerrar vínculo e seus acessos
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
