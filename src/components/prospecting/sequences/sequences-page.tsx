import { listScripts } from "@/lib/prospecting-scripts.functions";
import { SequenceReadiness } from "./sequence-readiness";
import { SequenceTemplatePicker } from "./sequence-template-picker";
import { InsertVariableButton } from "./sequence-variable-field";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  Phone,
  Clock3,
  GitBranch,
  ListTodo,
  Bot,
  CheckCircle2,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { PageHeader, EmptyState, Skeletons } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAudienceFilterFields } from "@/hooks/use-audience-filter-fields";
import { AudienceGroupsEditor } from "@/components/whatsapp/audience-groups-editor";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { listServiceChannels } from "@/lib/prospecting/sdr/channel-accounts.functions";
import {
  listProspectingSequenceDrafts,
  saveProspectingSequenceDraft,
  previewProspectingSequenceAudience,
} from "@/lib/prospecting/sequences/drafts.functions";
import {
  definitionSchema,
  newDefinition,
  newStep,
  STEP_LABELS,
  SEQUENCE_RESOURCE,
  type SequenceDraft,
  type SequenceDefinition,
  type SequenceStep,
} from "@/lib/prospecting/sequences/draft";
const ICONS = {
  email: Mail,
  whatsapp: MessageSquare,
  call: Phone,
  wait: Clock3,
  condition: GitBranch,
  task: ListTodo,
  agent: Bot,
  end: CheckCircle2,
};
const scopes = ["own", "team", "workspace"];
function Choice({
  label,
  value,
  choices,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  choices: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1 text-xs font-medium">
      <span>{label}</span>
      <select
        aria-label={label}
        disabled={disabled}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ProspectingSequencesPage() {
  const permissions = usePermissions(),
    query = useQueryClient();
  const can = (action: string) =>
    !permissions.isLoading &&
    !permissions.isError &&
    !!permissions.workspaceId &&
    permissions.canAny(scopes.map((s) => `${SEQUENCE_RESOURCE}.${action}.${s}`));
  const loadScripts = useServerFn(listScripts);
  const voiceScripts = useQuery({
    queryKey: ["sequence-voice-scripts", permissions.workspaceId],
    enabled:
      can("view") &&
      permissions.canAny(scopes.map((scope) => `techsales.prospecting_scripts.view.${scope}`)),
    queryFn: () => loadScripts(),
  });
  const listFn = useServerFn(listProspectingSequenceDrafts),
    saveFn = useServerFn(saveProspectingSequenceDraft);
  const [row, setRow] = useState<SequenceDraft | null>(null),
    [draft, setDraft] = useState<SequenceDefinition | null>(null),
    [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState<"flow" | "audience" | "settings">("flow"),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false);
  const members = useWorkspaceMembers();
  const currentWorkspace = useRef(permissions.workspaceId);
  currentWorkspace.current = permissions.workspaceId;
  const rows = useQuery({
    queryKey: ["prospecting-sequence-drafts", permissions.workspaceId],
    enabled: can("view"),
    queryFn: () => listFn({ data: { workspaceId: permissions.workspaceId! } }),
  });
  useEffect(() => {
    setRow(null);
    setDraft(null);
    setDirty(false);
  }, [permissions.workspaceId]);
  const variableFields = useAudienceFilterFields();
  const editable =
    !saving && !!row && (row.revision === 0 ? can("create") : row.can_edit && can("update"));
  const change = (next: SequenceDefinition) => {
    if (!editable) return;
    setDraft(next);
    setDirty(true);
  };
  const open = (r: SequenceDraft) => {
    if (saving) return;
    if (dirty && !window.confirm("Descartar as alterações não salvas deste rascunho?")) return;
    const parsed = definitionSchema.safeParse(r.definition);
    if (!parsed.success) {
      toast.error("Este rascunho tem uma definição inválida e não foi aberto.");
      return;
    }
    setRow(r);
    setDraft(parsed.data);
    setName(r.name);
    setSelected(parsed.data.steps[0]?.id || "");
    setDirty(false);
  };
  const create = () => {
    if (!can("create") || !permissions.workspaceId) return;
    open({
      id: crypto.randomUUID(),
      workspace_id: permissions.workspaceId,
      owner_id: "",
      name: "Nova sequência multicanal",
      revision: 0,
      definition: newDefinition(),
      updated_at: "",
      can_edit: true,
    });
  };
  const save = async () => {
    if (!row || !draft || !editable || saving) return;
    const workspaceId = permissions.workspaceId!;
    const parsed = definitionSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Revise a configuração.");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o nome da sequência.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFn({
        data: {
          id: row.id,
          workspaceId,
          expectedRevision: row.revision,
          name,
          definition: parsed.data,
        },
      });
      if (currentWorkspace.current !== workspaceId) return;
      setRow(saved);
      setDirty(false);
      toast.success("Rascunho salvo. Nenhuma execução foi iniciada.");
      await query.invalidateQueries({ queryKey: ["prospecting-sequence-drafts", workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };
  const channelsFn = useServerFn(listServiceChannels);
  const channels = useQuery({
    queryKey: ["sequence-channel-references", permissions.workspaceId],
    enabled: !!draft && permissions.can("system.channels.view.workspace"),
    queryFn: () => channelsFn(),
  });
  const step = draft?.steps.find((s) => s.id === selected);
  const updateStep = (patch: Record<string, unknown>) => {
    if (draft && step)
      change({
        ...draft,
        steps: draft.steps.map((s) =>
          s.id === step.id ? ({ ...s, ...patch } as SequenceStep) : s,
        ),
      });
  };
  const add = (type: SequenceStep["type"]) => {
    if (!draft) return;
    const s = newStep(type);
    change({ ...draft, steps: [...draft.steps, s] });
    setSelected(s.id);
  };
  const reorder = (direction: number) => {
    if (!draft || !step) return;
    const i = draft.steps.indexOf(step),
      j = i + direction;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    change({ ...draft, steps });
  };
  if (permissions.isLoading) return <Skeletons.Card />;
  if (permissions.isError)
    return (
      <EmptyState
        title="Não foi possível verificar suas permissões"
        description="Atualize a verificação antes de continuar."
        action={<Button onClick={permissions.refetch}>Tentar novamente</Button>}
      />
    );
  if (!can("view"))
    return (
      <EmptyState
        title="Sem acesso às sequências"
        description="Solicite a permissão de visualização de sequências."
      />
    );
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="TechSales · Prospecção"
        title="Sequências multicanal"
        description="Planeje sua abordagem por e-mail, WhatsApp e chamada."
        primaryAction={
          <Button disabled={!can("create") || saving} onClick={create}>
            <Plus className="mr-2 size-4" />
            Nova sequência
          </Button>
        }
      />
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Crie e valide uma versão, selecione o público e confirme o início. Salvar rascunhos não
        dispara mensagens.
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Choice
          label="Rascunhos recentes (até 100)"
          value={row?.revision ? row.id : ""}
          choices={[
            ["", "Selecione um rascunho"],
            ...(rows.data || []).map((r) => [r.id, r.name] as const),
          ]}
          onChange={(id) => {
            const r = rows.data?.find((r) => r.id === id);
            if (r) open(r);
          }}
        />
        {rows.isFetching && (
          <span className="text-xs text-muted-foreground">Atualizando rascunhos…</span>
        )}
        {rows.isError && (
          <Button variant="outline" onClick={() => rows.refetch()}>
            Tentar carregar novamente
          </Button>
        )}
      </div>
      {!draft || !row ? (
        <EmptyState
          title="Sua próxima conversa começa aqui"
          description="Crie uma sequência ou abra um rascunho salvo para planejar o público e as etapas."
          action={
            <Button disabled={!can("create") || saving} onClick={create}>
              Criar sequência
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-64 flex-1">
              <Label htmlFor="sequence-draft-name">Nome da sequência</Label>
              <Input
                id="sequence-draft-name"
                maxLength={120}
                disabled={!editable}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <Badge variant="outline">
              {row.revision ? `Rascunho · revisão ${row.revision}` : "Novo rascunho"}
              {dirty ? " · alterações não salvas" : ""}
            </Badge>
            <Button
              disabled={!editable || saving || (!dirty && row.revision > 0)}
              onClick={() => void save()}
            >
              <Save className="mr-2 size-4" />
              {saving ? "Salvando…" : "Salvar rascunho"}
            </Button>
          </div>
          <SequenceReadiness
            key={`${row.id}:${row.revision}`}
            row={row}
            disabled={dirty || saving || row.revision < 1}
          />
          <div className="flex gap-5 border-b">
            {(
              [
                ["flow", "Fluxo"],
                ["audience", "Público"],
                ["settings", "Canais e regras"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`border-b-2 px-1 py-3 text-sm ${tab === key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "audience" ? (
            <SequenceAudience
              definition={draft}
              disabled={!editable}
              onChange={change}
              workspaceId={permissions.workspaceId!}
            />
          ) : tab === "settings" ? (
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="text-base font-semibold">Regras da sequência</h2>
                <Choice
                  label="Agente padrão para respostas"
                  value={draft.settings.agentId || ""}
                  choices={[
                    ["", "Nenhum agente selecionado"],
                    ...(channels.data?.agents || []).map((a) => [a.id, a.name] as const),
                  ]}
                  disabled={!editable}
                  onChange={(agentId) =>
                    change({ ...draft, settings: { ...draft.settings, agentId: agentId || null } })
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    Intervalo mínimo por conta (segundos)
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={draft.settings.minimumIntervalSeconds ?? 60}
                      disabled={!editable}
                      onChange={(e) =>
                        change({
                          ...draft,
                          settings: {
                            ...draft.settings,
                            minimumIntervalSeconds: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    Limite por conta em 24 horas
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={draft.settings.dailyLimit ?? 100}
                      disabled={!editable}
                      onChange={(e) =>
                        change({
                          ...draft,
                          settings: { ...draft.settings, dailyLimit: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Os limites consideram os disparos desta conta nas sequências e não substituem os
                  limites do provedor. Respostas do agente continuam sob as regras de atendimento.
                </p>
                <fieldset disabled={!editable} className="space-y-4">
                  {(
                    [
                      ["stopOnReply", "Interromper contatos pendentes ao receber resposta"],
                      ["stopOnMeeting", "Encerrar após reunião confirmada"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.settings[key]}
                        onChange={(e) =>
                          change({
                            ...draft,
                            settings: { ...draft.settings, [key]: e.target.checked },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                  <label className="block text-xs">
                    Fuso horário
                    <Input
                      value={draft.settings.timezone}
                      maxLength={80}
                      onChange={(e) =>
                        change({
                          ...draft,
                          settings: { ...draft.settings, timezone: e.target.value },
                        })
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["start", "end"] as const).map((key) => (
                      <label key={key} className="text-xs">
                        {key === "start" ? "Início do expediente" : "Fim do expediente"}
                        <Input
                          placeholder="HH:mm"
                          value={draft.settings[key]}
                          onChange={(e) =>
                            change({
                              ...draft,
                              settings: { ...draft.settings, [key]: e.target.value },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-muted-foreground">
                  O atendimento e a agenda seguem as configurações do agente escolhido. Estas regras
                  passam a valer na versão criada; salvar não inicia contatos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-[190px_minmax(260px,1fr)_320px]">
              <Card>
                <CardContent className="space-y-2 p-4">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Próxima ação
                  </h2>
                  {(Object.keys(STEP_LABELS) as SequenceStep["type"][]).map((type) => {
                    const Icon = ICONS[type];
                    return (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal py-3 text-xs"
                        disabled={!editable || draft.steps.length >= 50}
                        onClick={() => add(type)}
                      >
                        <Icon className="mr-2 size-4 shrink-0" />
                        {STEP_LABELS[type]}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
              <div className="rounded-lg border bg-muted/20 p-5">
                <button
                  className="w-full rounded-md border border-dashed border-primary bg-background p-4 text-left"
                  onClick={() => setTab("audience")}
                >
                  <b className="text-sm">Público da sequência</b>
                  <p className="text-xs text-muted-foreground">
                    {draft.audience.base === "contacts" ? "Contatos" : "Leads"} ·{" "}
                    {draft.audience.groups.length} grupos de filtros
                  </p>
                </button>
                {draft.steps.map((s, i) => {
                  const Icon = ICONS[s.type];
                  return (
                    <div key={s.id}>
                      <div className="mx-auto h-6 w-px bg-border" />
                      <button
                        className={`flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-xs ${s.id === selected ? "border-primary ring-2 ring-primary/10" : "border-border"}`}
                        onClick={() => setSelected(s.id)}
                      >
                        <span className="rounded-md bg-primary/5 p-2 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{s.title}</b>
                          <span className="text-xs text-muted-foreground">
                            {s.type === "wait"
                              ? `${s.duration} ${s.unit === "hours" ? "horas" : s.unit === "business_days" ? "dias úteis" : "dias corridos"}`
                              : STEP_LABELS[s.type]}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </button>
                      {s.type === "wait" && (
                        <p className="mt-1 text-right text-[11px] text-muted-foreground">
                          Se respondeu → {s.onReply === "agent" ? "Agente" : "Responsável humano"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Card>
                <CardContent className="space-y-4 p-5">
                  {step ? (
                    <>
                      <h2 className="font-semibold">{STEP_LABELS[step.type]}</h2>
                      <fieldset disabled={!editable} className="space-y-4">
                        <label className="block text-xs">
                          Nome da etapa
                          <Input
                            maxLength={120}
                            value={step.title}
                            onChange={(e) => updateStep({ title: e.target.value })}
                          />
                        </label>
                        {(step.type === "email" || step.type === "whatsapp") && (
                          <Choice
                            label="Conta remetente"
                            value={step.accountId || ""}
                            choices={[
                              [
                                "",
                                channels.isError
                                  ? "Não foi possível carregar contas"
                                  : "Selecionar conta",
                              ],
                              ...(channels.data?.accounts || [])
                                .filter(
                                  (a) =>
                                    a.channel === (step.type === "email" ? "email" : "whatsapp"),
                                )
                                .map((a) => [a.id, a.label] as const),
                            ]}
                            onChange={(accountId) =>
                              updateStep(
                                step.type === "whatsapp"
                                  ? {
                                      accountId: accountId || null,
                                      templateName: "",
                                      variables: {},
                                    }
                                  : { accountId: accountId || null },
                              )
                            }
                            disabled={!permissions.can("system.channels.view.workspace")}
                          />
                        )}
                        {step.type === "email" && (
                          <>
                            <div className="flex justify-end gap-2">
                              <InsertVariableButton
                                fields={variableFields.fields}
                                disabled={!editable}
                                onInsert={(t) => updateStep({ subject: `${step.subject}${t}` })}
                              />
                            </div>
                            <label className="block text-xs">
                              Assunto
                              <Input
                                maxLength={255}
                                value={step.subject}
                                onChange={(e) => updateStep({ subject: e.target.value })}
                              />
                            </label>
                            <div className="flex items-center justify-between text-xs">
                              <span>Mensagem</span>
                              <InsertVariableButton
                                fields={variableFields.fields}
                                disabled={!editable}
                                onInsert={(t) => updateStep({ body: `${step.body}${t}` })}
                              />
                            </div>
                            <label className="block text-xs">
                              <span className="sr-only">Mensagem</span>
                              <Textarea
                                rows={7}
                                maxLength={10000}
                                value={step.body}
                                onChange={(e) => updateStep({ body: e.target.value })}
                              />
                            </label>
                            <Choice
                              label="Conversa"
                              value={step.thread}
                              choices={[
                                ["new", "Nova conversa"],
                                ["reply", "Continuar e-mail anterior"],
                              ]}
                              onChange={(thread) => updateStep({ thread })}
                            />
                          </>
                        )}
                        {step.type === "whatsapp" && (
                          <SequenceTemplatePicker
                            key={`${step.id}:${step.accountId}`}
                            workspaceId={permissions.workspaceId!}
                            step={step}
                            disabled={!editable}
                            onChange={updateStep}
                          />
                        )}
                        {step.type === "whatsapp" && (
                          <Choice
                            label="Agente para respostas neste número"
                            value={step.agentId || ""}
                            choices={[
                              ["", "Usar agente padrão das regras"],
                              ...(channels.data?.agents || []).map((a) => [a.id, a.name] as const),
                            ]}
                            onChange={(agentId) => updateStep({ agentId: agentId || null })}
                          />
                        )}
                        {step.type === "wait" && (
                          <>
                            <label className="block text-xs">
                              Prazo máximo
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                value={step.duration}
                                onChange={(e) => updateStep({ duration: Number(e.target.value) })}
                              />
                            </label>
                            <Choice
                              label="Unidade"
                              value={step.unit}
                              choices={[
                                ["hours", "Horas"],
                                ["days", "Dias corridos"],
                                ["business_days", "Dias úteis"],
                              ]}
                              onChange={(unit) => updateStep({ unit })}
                            />
                            <Choice
                              label="Observar resposta"
                              value={step.source}
                              choices={[
                                ["previous", "Canal da etapa anterior"],
                                ["any", "Qualquer canal associado"],
                              ]}
                              onChange={(source) => updateStep({ source })}
                            />
                            <Choice
                              label="Ao responder, encaminhar para"
                              value={step.onReply}
                              choices={[
                                ["agent", "Agente configurado"],
                                ["human", "Responsável humano"],
                              ]}
                              onChange={(onReply) => updateStep({ onReply })}
                            />
                          </>
                        )}
                        {(step.type === "task" ||
                          (step.type === "call" && step.mode === "human")) && (
                          <Choice
                            label="Responsável pela tarefa"
                            value={step.assigneeId || ""}
                            choices={[
                              ["", "Selecionar responsável"],
                              ...(members.data || []).map(
                                (m) => [m.user_id, m.full_name || "Sem nome"] as const,
                              ),
                            ]}
                            onChange={(assigneeId) =>
                              updateStep({ assigneeId: assigneeId || null })
                            }
                          />
                        )}
                        {step.type === "call" && (
                          <>
                            <Choice
                              label="Modo de chamada"
                              value={step.mode}
                              choices={[
                                ["human", "Humana · criar tarefa"],
                                ["automatic", "Automática · telefonia"],
                              ]}
                              onChange={(mode) =>
                                updateStep({
                                  mode,
                                  ...(mode === "automatic" ? { attempts: 1 } : {}),
                                })
                              }
                            />
                            {step.mode === "automatic" && (
                              <>
                                <Choice
                                  label="Roteiro da telefonia"
                                  value={step.scriptId || ""}
                                  choices={[
                                    ["", "Selecione o roteiro"],
                                    ...(voiceScripts.data || [])
                                      .filter(
                                        (s) =>
                                          !(s as typeof s & { archived_at?: string | null })
                                            .archived_at,
                                      )
                                      .map((s) => [s.id, s.name] as const),
                                  ]}
                                  onChange={(scriptId) =>
                                    updateStep({ scriptId: scriptId || null })
                                  }
                                />
                                {voiceScripts.isError && (
                                  <p role="alert" className="text-xs text-destructive">
                                    Não foi possível consultar os roteiros.
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Uma chamada por etapa. Para tentar novamente, adicione uma espera
                                  e outra chamada. A sequência aguarda o resultado da telefonia.
                                </p>
                              </>
                            )}
                            <label className="block text-xs">
                              Roteiro
                              <Textarea
                                maxLength={5000}
                                rows={6}
                                value={step.notes}
                                onChange={(e) => updateStep({ notes: e.target.value })}
                              />
                            </label>
                            {step.mode === "human" && (
                              <label className="block text-xs">
                                Máximo de tentativas planejadas para a tarefa
                                <Input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={step.attempts}
                                  onChange={(e) => updateStep({ attempts: Number(e.target.value) })}
                                />
                              </label>
                            )}
                          </>
                        )}
                        {step.type === "condition" && (
                          <>
                            <Choice
                              label="Critério"
                              value={step.criteria}
                              choices={[
                                ["replied", "Respondeu"],
                                ["has_email", "Possui e-mail"],
                                ["has_whatsapp", "Possui WhatsApp"],
                                ["call_answered", "Chamada atendida"],
                                ["meeting_booked", "Reunião confirmada"],
                              ]}
                              onChange={(criteria) => updateStep({ criteria })}
                            />
                            <Choice
                              label="Caminho Sim"
                              value={step.yes}
                              choices={[
                                ["agent", "Agente"],
                                ["human", "Responsável humano"],
                                ["end", "Encerrar"],
                                ["next", "Próxima etapa"],
                              ]}
                              onChange={(yes) => updateStep({ yes })}
                            />
                            <Choice
                              label="Caminho Não"
                              value={step.no}
                              choices={[
                                ["next", "Próxima etapa"],
                                ["human", "Responsável humano"],
                                ["end", "Encerrar"],
                              ]}
                              onChange={(no) => updateStep({ no })}
                            />
                          </>
                        )}
                        {step.type === "task" && (
                          <label className="block text-xs">
                            Instruções
                            <Textarea
                              rows={6}
                              value={step.notes}
                              onChange={(e) => updateStep({ notes: e.target.value })}
                            />
                          </label>
                        )}
                        {step.type === "agent" && (
                          <>
                            <Choice
                              label="Agente"
                              value={step.agentId || ""}
                              choices={[
                                ["", "Selecionar agente"],
                                ...(channels.data?.agents || []).map(
                                  (a) => [a.id, a.name] as const,
                                ),
                              ]}
                              onChange={(agentId) => updateStep({ agentId: agentId || null })}
                            />
                            <label className="block text-xs">
                              Objetivo
                              <Textarea
                                rows={6}
                                value={step.objective}
                                onChange={(e) => updateStep({ objective: e.target.value })}
                              />
                            </label>
                          </>
                        )}
                        {step.type === "end" && (
                          <label className="block text-xs">
                            Motivo de encerramento
                            <Input
                              maxLength={120}
                              value={step.reason}
                              onChange={(e) => updateStep({ reason: e.target.value })}
                            />
                          </label>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Mover etapa para cima"
                            disabled={draft.steps[0] === step}
                            onClick={() => reorder(-1)}
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Mover etapa para baixo"
                            disabled={draft.steps.at(-1) === step}
                            onClick={() => reorder(1)}
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Duplicar etapa"
                            disabled={draft.steps.length >= 50}
                            onClick={() => {
                              const copy = { ...step, id: crypto.randomUUID() };
                              change({ ...draft, steps: [...draft.steps, copy] });
                              setSelected(copy.id);
                            }}
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Remover etapa"
                            disabled={draft.steps.length < 2}
                            onClick={() => {
                              change({
                                ...draft,
                                steps: draft.steps.filter((s) => s.id !== step.id),
                              });
                              setSelected(draft.steps.find((s) => s.id !== step.id)?.id || "");
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </fieldset>
                      <p className="text-[11px] text-muted-foreground">
                        Planejamento em rascunho. Salve no topo para persistir suas alterações.
                      </p>
                    </>
                  ) : (
                    <p>Selecione uma etapa.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function SequenceAudience({
  definition,
  disabled,
  onChange,
  workspaceId,
}: {
  definition: SequenceDefinition;
  disabled: boolean;
  onChange: (d: SequenceDefinition) => void;
  workspaceId: string;
}) {
  const fields = useAudienceFilterFields(),
    members = useWorkspaceMembers(),
    previewFn = useServerFn(previewProspectingSequenceAudience);
  const debounced = useDebouncedValue(definition, 600);
  const preview = useQuery({
    queryKey: ["sequence-draft-preview", workspaceId, debounced.audience],
    queryFn: () => previewFn({ data: { workspaceId, audience: debounced.audience } }),
  });
  const set = (patch: Partial<SequenceDefinition["audience"]>) => {
    if (!disabled) onChange({ ...definition, audience: { ...definition.audience, ...patch } });
  };
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,1fr)]">
      <Card>
        <CardContent className="p-5">
          <fieldset disabled={disabled} className="space-y-4">
            <Choice
              label="Destinatários da sequência"
              value={definition.audience.base}
              choices={[
                ["contacts", "Contatos"],
                ["leads", "Leads"],
              ]}
              onChange={(base) => set({ base: base as "contacts" | "leads", groups: [] })}
            />
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Combine campos de Leads, Contatos, Empresas e Negócios. O catálogo e os seletores são
              os mesmos das campanhas WhatsApp.
            </p>
            <AudienceGroupsEditor
              base={definition.audience.base}
              groups={definition.audience.groups}
              groupsLogic={definition.audience.groupsLogic}
              onGroupsLogicChange={(groupsLogic) => set({ groupsLogic })}
              onChange={(groups) =>
                set({
                  groups: groups.map((group) => ({
                    ...group,
                    filters: group.filters.map((filter) => ({
                      ...filter,
                      entity: filter.entity ?? definition.audience.base,
                    })),
                  })),
                })
              }
              fields={fields.fields}
              members={(members.data || []).map((m) => ({
                value: m.user_id,
                label: m.full_name || "Sem nome",
              }))}
            />
            <h3 className="border-t pt-4 text-sm font-semibold">Exclusões planejadas</h3>
            {(
              [
                ["excludeCustomers", "Clientes atuais"],
                ["excludeOpenDeals", "Pessoas com negociação aberta"],
                ["excludeOtherSequences", "Pessoas em outra sequência"],
              ] as const
            ).map(([key, label]) => (
              <label className="flex gap-2 text-sm" key={key}>
                <input
                  type="checkbox"
                  checked={definition.audience[key]}
                  onChange={(e) => set({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
            <Choice
              label="Entrada na sequência"
              value={definition.audience.entry}
              choices={[
                ["fixed", "Lista fixa"],
                ["dynamic", "Automática ao atender aos critérios"],
              ]}
              onChange={(entry) => set({ entry: entry as "fixed" | "dynamic" })}
            />
          </fieldset>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Prévia dos filtros</h2>
            {preview.isPending ? (
              <Skeletons.Card />
            ) : preview.isError ? (
              <>
                <p className="text-sm text-destructive">Não foi possível calcular o público.</p>
                <Button variant="outline" onClick={() => preview.refetch()}>
                  Tentar novamente
                </Button>
              </>
            ) : (
              <>
                <b className="block text-4xl">
                  {preview.data.found}
                  {preview.data.truncated ? "+" : ""}
                </b>
                <p className="text-xs text-muted-foreground">
                  Pessoas visíveis que atendem aos filtros
                  {preview.data.truncated ? " · limite da amostra atingido" : ""}.
                </p>
                <div className="space-y-2 text-sm">
                  <p>Com e-mail cadastrado: {preview.data.email}</p>
                  <p>Com telefone cadastrado: {preview.data.phone}</p>
                  <p>Números no padrão WhatsApp: {preview.data.whatsapp}</p>
                </div>
              </>
            )}
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Esta é a prévia dos filtros, antes das exclusões de contato. Autorização, opt-out,
              contas e deduplicação são conferidos na inscrição e novamente antes de cada ação.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">Amostra</h3>
            {preview.data?.samples.map((p) => (
              <p key={p.id} className="border-b pb-2 text-sm">
                {p.name}
              </p>
            ))}
            {preview.data?.samples.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum registro atende aos filtros.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
