// Quadro "Público" + mapeamento de variáveis da nova campanha de WhatsApp.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listQueues } from "@/lib/prospecting/queues.functions";
import { listSegments, upsertSegment } from "@/lib/segments.functions";
import { previewCampaignAudience } from "@/lib/whatsapp-campaigns.functions";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useAudienceFilterFields } from "@/hooks/use-audience-filter-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  BASE_LABEL,
  FREE_TEXT_FIELD,
  FREE_TEXT_MAX,
  GROUP_LABEL,
  fieldsForBase,
  type AudienceBase,
  normalizeAudienceGroups,
  type AudienceFilter,
  type AudienceGroup,
  type FieldGroup,
  type VariableMap,
} from "@/lib/whatsapp/campaign-audience";
import { toast } from "sonner";
import { AudienceGroupsEditor } from "./audience-groups-editor";

const ENTITIES = ["leads", "contacts", "companies", "deals"] as const;

/** Grupos → segmento: OU entre grupos; campo relacionado vira "entidade.coluna". */
function groupsToSegment(
  groups: AudienceGroup[],
  base: AudienceBase,
  groupsLogic: "and" | "or" = "or",
) {
  return {
    type: "group" as const,
    op: groupsLogic,
    conditions: normalizeAudienceGroups({ groups }).map((g) => ({
      type: "group" as const,
      op: g.logic,
      conditions: g.filters.map((f) => ({
        type: "condition" as const,
        field: (f.entity ?? base) === base ? f.column : `${f.entity}.${f.column}`,
        op: f.op,
        value: f.value,
      })),
    })),
  };
}

type SegCond = {
  type?: string;
  field?: string;
  op?: string;
  value?: unknown;
  conditions?: SegCond[];
};

/** Segmento (formato antigo plano ou em grupos) → grupos do editor. */
function segmentToGroups(raw: unknown, base: AudienceBase): AudienceGroup[] {
  const root = (raw ?? {}) as SegCond & { op?: string };
  const toFilter = (c: SegCond): AudienceFilter | null => {
    if (!c.field) return null;
    const [maybeEntity, col] = c.field.split(".");
    const entity =
      col && (ENTITIES as readonly string[]).includes(maybeEntity)
        ? (maybeEntity as AudienceBase)
        : base;
    return {
      entity,
      column: col ?? c.field,
      op: (c.op as AudienceFilter["op"]) ?? "eq",
      value: c.value == null ? "" : String(c.value),
    };
  };
  const conds = root.conditions ?? [];
  const nested = conds.some((c) => Array.isArray(c.conditions));
  const groups = nested
    ? conds.map((g) => ({
        logic: (g.op === "or" ? "or" : "and") as "and" | "or",
        filters: (g.conditions ?? []).map(toFilter).filter((f): f is AudienceFilter => !!f),
      }))
    : [
        {
          logic: (root.op === "or" ? "or" : "and") as "and" | "or",
          filters: conds.map(toFilter).filter((f): f is AudienceFilter => !!f),
        },
      ];
  return groups.filter((g) => g.filters.length);
}

/** Operador entre grupos salvo no segmento (só no formato em grupos; padrão OU). */
function segmentGroupsLogic(raw: unknown): "and" | "or" {
  const root = (raw ?? {}) as SegCond;
  const nested = (root.conditions ?? []).some((c) => Array.isArray(c.conditions));
  return nested && root.op === "and" ? "and" : "or";
}

export type AudienceMode = "queue" | "filter" | "manual";
export type AudienceState = {
  mode: AudienceMode;
  queueId: string;
  base: AudienceBase;
  groups: AudienceGroup[];
  groupsLogic: "and" | "or";
  variableMap: VariableMap;
  skipMissing: boolean;
  /** Dias sem reenviar a quem recebeu WhatsApp de outra campanha (0 desliga). */
  recentDays: number;
  /** Telefones liberados manualmente apesar do envio recente. */
  recentOverrides: string[];
  /** Não enviar a quem já é cliente (negócio ganho ou contrato ativo). */
  excludeCustomers: boolean;
  /** Não enviar a quem tem negociação aberta. */
  excludeOpenDeals: boolean;
  /** Telefones liberados manualmente apesar do bloqueio comercial. */
  commercialOverrides: string[];
};

export const EMPTY_AUDIENCE: AudienceState = {
  mode: "queue",
  queueId: "",
  base: "contacts",
  groups: [],
  groupsLogic: "or",
  variableMap: {},
  skipMissing: false,
  recentDays: 7,
  recentOverrides: [],
  excludeCustomers: true,
  excludeOpenDeals: true,
  commercialOverrides: [],
};

export function audiencePayload(a: AudienceState) {
  if (a.mode === "queue" && a.queueId) return { type: "queue" as const, queue_id: a.queueId };
  if (a.mode === "filter")
    return {
      type: "filter" as const,
      base: a.base,
      groups: normalizeAudienceGroups({ groups: a.groups }),
      groups_logic: a.groupsLogic,
    };
  return undefined;
}

/** Configuração guardada na campanha para reabrir o quadro Público na edição. */
export type StoredAudienceConfig = { state: AudienceState; manualRaw: string };

export function toAudienceConfig(a: AudienceState, manualRaw: string): StoredAudienceConfig {
  return { state: a, manualRaw: a.mode === "manual" ? manualRaw : "" };
}

/** Lê a configuração salva; formatos ausentes ou antigos viram null. */
export function hydrateAudienceConfig(raw: unknown): StoredAudienceConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { state?: Partial<AudienceState>; manualRaw?: unknown };
  const st = r.state;
  if (!st || (st.mode !== "queue" && st.mode !== "filter" && st.mode !== "manual")) return null;
  return {
    state: {
      ...EMPTY_AUDIENCE,
      ...st,
      groups: normalizeAudienceGroups({ groups: st.groups ?? [] }),
      groupsLogic: st.groupsLogic === "and" ? "and" : "or",
      variableMap: st.variableMap ?? {},
      recentOverrides: Array.isArray(st.recentOverrides) ? st.recentOverrides : [],
      excludeCustomers: st.excludeCustomers !== false,
      excludeOpenDeals: st.excludeOpenDeals !== false,
      commercialOverrides: Array.isArray(st.commercialOverrides) ? st.commercialOverrides : [],
    } as AudienceState,
    manualRaw: typeof r.manualRaw === "string" ? r.manualRaw : "",
  };
}

type QueueRow = { id: string; name: string; entity: string; kind: string };
type SegmentRow = { id: string; name: string; entity: string; filters: unknown };

export function CampaignAudiencePanel({
  value,
  onChange,
  variableCount,
  manualRaw,
  onManualRaw,
  manualCount,
  readOnly = false,
}: {
  readOnly?: boolean;
  value: AudienceState;
  onChange: (v: AudienceState) => void;
  variableCount: number;
  manualRaw: string;
  onManualRaw: (s: string) => void;
  manualCount: number;
}) {
  const queuesFn = useServerFn(listQueues);
  const segmentsFn = useServerFn(listSegments);
  const saveSegFn = useServerFn(upsertSegment);
  const previewFn = useServerFn(previewCampaignAudience);
  const members = useWorkspaceMembers();
  const filterFields = useAudienceFilterFields();
  const queuesQ = useQuery({ queryKey: ["wa-camp-queues"], queryFn: () => queuesFn() });
  const segmentsQ = useQuery({ queryKey: ["wa-camp-segments"], queryFn: () => segmentsFn() });
  const queues = (queuesQ.data ?? []) as QueueRow[];
  const segments = ((segmentsQ.data?.segments ?? []) as SegmentRow[]).filter(
    (s) => s.entity === value.base,
  );

  const queueBase: AudienceBase | null = useMemo(() => {
    const q = queues.find((x) => x.id === value.queueId);
    return q ? (q.entity === "lead" ? "leads" : "contacts") : null;
  }, [queues, value.queueId]);
  const effectiveBase =
    value.mode === "queue" ? queueBase : value.mode === "filter" ? value.base : null;
  const fields = effectiveBase ? fieldsForBase(effectiveBase) : [];
  const payload = audiencePayload(value);
  const debounced = useDebouncedValue(
    JSON.stringify({
      audience: payload,
      variable_map: value.variableMap,
      recent_contact_days: value.recentDays,
      recent_overrides: value.recentOverrides,
      exclude_customers: value.excludeCustomers,
      exclude_open_deals: value.excludeOpenDeals,
      commercial_overrides: value.commercialOverrides,
    }),
    500,
  );
  const previewQ = useQuery({
    queryKey: ["wa-camp-preview", debounced],
    enabled: !!payload && !!(JSON.parse(debounced) as { audience?: unknown }).audience,
    queryFn: () => previewFn({ data: JSON.parse(debounced) }),
  });

  const set = (patch: Partial<AudienceState>) => onChange({ ...value, ...patch });
  const setVar = (k: string, patch: Partial<{ field: string; fallback: string }>) =>
    set({
      variableMap: {
        ...value.variableMap,
        [k]: {
          ...value.variableMap[k],
          ...patch,
          field: patch.field ?? value.variableMap[k]?.field ?? "",
        },
      },
    });

  const groups = [...new Set(fields.map((f) => f.group))] as FieldGroup[];
  const p = previewQ.data;

  return (
    <fieldset disabled={readOnly} aria-readonly={readOnly} className="min-w-0 space-y-4">
      {readOnly && (
        <p className="text-xs text-muted-foreground">
          Campanha pausada: o público e as variáveis ficam somente para leitura.
        </p>
      )}
      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Público</legend>
        <Tabs value={value.mode} onValueChange={(m) => set({ mode: m as AudienceMode })}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="queue">Fila de prospecção</TabsTrigger>
            <TabsTrigger value="filter">Criar público</TabsTrigger>
            <TabsTrigger value="manual">Lista manual</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-2">
            <label htmlFor="aud-queue" className="text-xs text-muted-foreground">
              Fila
            </label>
            {queuesQ.isError ? (
              <p className="text-xs text-destructive">
                Não foi possível carregar as filas.{" "}
                <Button size="sm" variant="link" onClick={() => void queuesQ.refetch()}>
                  Tentar de novo
                </Button>
              </p>
            ) : (
              <Select
                value={value.queueId}
                onValueChange={(id) => set({ queueId: id, variableMap: {} })}
              >
                <SelectTrigger id="aud-queue">
                  <SelectValue
                    placeholder={
                      queuesQ.isLoading
                        ? "Carregando filas…"
                        : queues.length
                          ? "Escolha uma fila"
                          : "Nenhuma fila no workspace"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name} · {q.entity === "lead" ? "Leads" : "Contatos"} ·{" "}
                      {q.kind === "manual" ? "estática" : "dinâmica"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TabsContent>

          <TabsContent value="filter" className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="aud-base" className="text-xs text-muted-foreground">
                  Base
                </label>
                <Select
                  value={value.base}
                  onValueChange={(b) =>
                    set({ base: b as AudienceBase, groups: [], groupsLogic: "or", variableMap: {} })
                  }
                >
                  <SelectTrigger id="aud-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BASE_LABEL) as AudienceBase[]).map((b) => (
                      <SelectItem key={b} value={b}>
                        {BASE_LABEL[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="aud-seg" className="text-xs text-muted-foreground">
                  Carregar segmento salvo
                </label>
                <Select
                  value=""
                  onValueChange={(id) => {
                    const s = segments.find((x) => x.id === id);
                    if (s)
                      set({
                        groups: segmentToGroups(s.filters, value.base),
                        groupsLogic: segmentGroupsLogic(s.filters),
                      });
                  }}
                >
                  <SelectTrigger id="aud-seg">
                    <SelectValue placeholder={segments.length ? "Escolher…" : "Nenhum segmento"} />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AudienceGroupsEditor
              base={value.base}
              groups={value.groups}
              onChange={(groups) => set({ groups })}
              groupsLogic={value.groupsLogic}
              fields={filterFields.fields}
              onGroupsLogicChange={(groupsLogic) => set({ groupsLogic })}
              members={(members.data ?? []).map((m) => ({
                value: m.user_id,
                label: m.full_name || "Sem nome",
              }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const name = window.prompt("Nome do segmento");
                  if (!name?.trim()) return;
                  try {
                    await saveSegFn({
                      data: {
                        name: name.trim(),
                        entity: value.base,
                        kind: "dynamic",
                        filters: groupsToSegment(value.groups, value.base, value.groupsLogic),
                      },
                    });
                    toast.success("Segmento salvo");
                    void segmentsQ.refetch();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
                  }
                }}
              >
                Salvar como segmento
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-1">
            <label htmlFor="aud-manual" className="text-xs text-muted-foreground">
              Destinatários (um por linha: telefone,var1,var2,...)
            </label>
            <Textarea
              id="aud-manual"
              rows={5}
              value={manualRaw}
              onChange={(e) => onManualRaw(e.target.value)}
              placeholder={"+5511999999999,João,14h\n+5511888888888,Maria,16h"}
            />
            <p className="text-xs text-muted-foreground">{manualCount} destinatário(s)</p>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="aud-recent-days" className="text-muted-foreground">
            Não enviar para quem recebeu WhatsApp de outra campanha nos últimos
          </label>
          <Input
            id="aud-recent-days"
            type="number"
            min={0}
            max={365}
            className="h-8 w-20"
            value={value.recentDays}
            onChange={(e) =>
              set({ recentDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })
            }
          />
          <span className="text-muted-foreground">dias (0 desliga)</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label htmlFor="aud-excl-customers" className="flex items-center gap-2">
            <input
              id="aud-excl-customers"
              type="checkbox"
              disabled={readOnly}
              checked={value.excludeCustomers}
              onChange={(e) => set({ excludeCustomers: e.target.checked })}
            />
            Não enviar a quem já é cliente (negócio ganho ou contrato ativo)
          </label>
          <label htmlFor="aud-excl-open" className="flex items-center gap-2">
            <input
              id="aud-excl-open"
              type="checkbox"
              disabled={readOnly}
              checked={value.excludeOpenDeals}
              onChange={(e) => set({ excludeOpenDeals: e.target.checked })}
            />
            Não enviar a quem está em negociação aberta
          </label>
        </div>

        {payload && (
          <div className="rounded-md bg-muted/50 p-2 text-xs" aria-live="polite">
            {previewQ.isLoading || previewQ.isFetching ? (
              <span className="text-muted-foreground">Calculando público…</span>
            ) : previewQ.isError ? (
              <span className="text-destructive">
                {(previewQ.error as Error).message || "Não foi possível calcular o público."}
              </span>
            ) : p ? (
              <div className="space-y-1">
                <div>
                  <strong>{p.included}</strong> destinatário(s) incluídos de {p.found} registro(s)
                  {p.truncated ? " (acima do limite de 5.000)" : ""}.
                </div>
                <div className="text-muted-foreground">
                  Fora: {p.excluded.no_phone} sem telefone · {p.excluded.invalid_phone} telefone
                  inválido · {p.excluded.landline ?? 0} fixo, estrangeiro ou fora do padrão ·{" "}
                  {p.excluded.duplicate} duplicado · {p.excluded.opted_out} descadastrado ·{" "}
                  {p.recentRemovedCount} por envio recente
                  {p.recentOverriddenCount > 0
                    ? ` · ${p.recentOverriddenCount} liberado(s) manualmente`
                    : ""}{" "}
                  · {p.commercialRemovedCount} cliente ou em negociação
                  {p.commercialOverriddenCount > 0
                    ? ` (${p.commercialOverriddenCount} liberado(s))`
                    : ""}
                </div>
                {(p.commercialRemovedCount > 0 || value.commercialOverrides.length > 0) && (
                  <details className="pt-1">
                    <summary className="cursor-pointer font-medium">
                      {p.commercialRemovedCount} contato(s) retirado(s) por ser cliente ou estar em
                      negociação
                    </summary>
                    <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
                      {value.commercialOverrides.map((ph) => (
                        <li key={`cov-${ph}`} className="flex items-center gap-2">
                          <input
                            id={`cov-${ph}`}
                            type="checkbox"
                            checked
                            disabled={readOnly}
                            onChange={() =>
                              set({
                                commercialOverrides: value.commercialOverrides.filter(
                                  (x) => x !== ph,
                                ),
                              })
                            }
                          />
                          <label htmlFor={`cov-${ph}`}>{ph} — liberado manualmente</label>
                        </li>
                      ))}
                      {p.commercialRemoved.map((r) => (
                        <li key={`cr-${r.phone}`} className="flex items-center gap-2">
                          <input
                            id={`cr-${r.phone}`}
                            type="checkbox"
                            checked={false}
                            disabled={readOnly}
                            onChange={() =>
                              set({ commercialOverrides: [...value.commercialOverrides, r.phone] })
                            }
                          />
                          <label htmlFor={`cr-${r.phone}`}>
                            {r.label || r.phone} · {r.phone} — {r.reason}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {(p.recentRemovedCount > 0 || value.recentOverrides.length > 0) && (
                  <details className="pt-1">
                    <summary className="cursor-pointer font-medium">
                      {p.recentRemovedCount} contato(s) retirado(s) por envio recente
                    </summary>
                    <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
                      {value.recentOverrides.map((ph) => (
                        <li key={`ov-${ph}`} className="flex items-center gap-2">
                          <input
                            id={`ov-${ph}`}
                            type="checkbox"
                            checked
                            onChange={() =>
                              set({
                                recentOverrides: value.recentOverrides.filter((x) => x !== ph),
                              })
                            }
                          />
                          <label htmlFor={`ov-${ph}`}>{ph} — liberado manualmente</label>
                        </li>
                      ))}
                      {p.recentRemoved.map((r) => (
                        <li key={r.phone} className="flex items-center gap-2">
                          <input
                            id={`rr-${r.phone}`}
                            type="checkbox"
                            checked={false}
                            onChange={() =>
                              set({ recentOverrides: [...value.recentOverrides, r.phone] })
                            }
                          />
                          <label htmlFor={`rr-${r.phone}`}>
                            {r.label || r.phone} · {r.phone} — {r.campaignName} em{" "}
                            {new Date(r.at).toLocaleDateString("pt-BR")}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-muted-foreground">
                      Marque para incluir mesmo assim; a liberação fica registrada no destinatário.
                    </p>
                  </details>
                )}
              </div>
            ) : null}
          </div>
        )}
      </fieldset>

      {variableCount > 0 && value.mode !== "manual" && (
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Variáveis do modelo</legend>
          {!effectiveBase ? (
            <p className="text-xs text-muted-foreground">
              Escolha o público para definir as variáveis.
            </p>
          ) : (
            Array.from({ length: variableCount }, (_, i) => String(i + 1)).map((k) => (
              <div
                key={k}
                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[3rem_1fr_1fr]"
              >
                <span className="font-mono text-xs">{`{{${k}}}`}</span>
                <Select
                  value={value.variableMap[k]?.field ?? ""}
                  onValueChange={(field) => setVar(k, { field })}
                >
                  <SelectTrigger aria-label={`Campo da variável ${k}`}>
                    <SelectValue placeholder="Escolha o campo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Livre</SelectLabel>
                      <SelectItem value={FREE_TEXT_FIELD}>Texto livre</SelectItem>
                    </SelectGroup>
                    {groups.map((g) => (
                      <SelectGroup key={g}>
                        <SelectLabel>{GROUP_LABEL[g]}</SelectLabel>
                        {fields
                          .filter((f) => f.group === g)
                          .map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {value.variableMap[k]?.field === FREE_TEXT_FIELD ? (
                  <Input
                    aria-label={`Texto da variável ${k}`}
                    placeholder="Texto da variável (obrigatório)"
                    maxLength={FREE_TEXT_MAX}
                    value={value.variableMap[k]?.fallback ?? ""}
                    onChange={(e) =>
                      setVar(k, { fallback: e.target.value.replace(/[\r\n]+/g, " ") })
                    }
                  />
                ) : (
                  <Input
                    aria-label={`Valor se vazio para a variável ${k}`}
                    placeholder="Valor se vazio (opcional)"
                    value={value.variableMap[k]?.fallback ?? ""}
                    onChange={(e) => setVar(k, { fallback: e.target.value })}
                  />
                )}
              </div>
            ))
          )}
          {p?.samples?.[0] && (
            <p className="text-xs text-muted-foreground">
              Prévia ({p.samples[0].label}):{" "}
              {Array.from({ length: variableCount }, (_, i) => String(i + 1))
                .map((k) => `{{${k}}} = ${p.samples[0].variables[k] ?? "—"}`)
                .join(" · ")}
            </p>
          )}
          {p && p.withMissing > 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <Switch
                id="aud-skip"
                checked={value.skipMissing}
                onCheckedChange={(v) => set({ skipMissing: v })}
              />
              <label htmlFor="aud-skip">
                {p.withMissing} destinatário(s) com variável vazia — pular esses destinatários
              </label>
            </div>
          )}
        </fieldset>
      )}
    </fieldset>
  );
}
