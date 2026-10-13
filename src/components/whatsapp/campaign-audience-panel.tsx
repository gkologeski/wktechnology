// Quadro "Público" + mapeamento de variáveis da nova campanha de WhatsApp.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  BASE_LABEL,
  FILTER_FIELDS,
  GROUP_LABEL,
  fieldsForBase,
  type AudienceBase,
  type AudienceFilter,
  type FieldGroup,
  type VariableMap,
} from "@/lib/whatsapp/campaign-audience";
import { toast } from "sonner";

export type AudienceMode = "queue" | "filter" | "manual";
export type AudienceState = {
  mode: AudienceMode;
  queueId: string;
  base: AudienceBase;
  filters: AudienceFilter[];
  variableMap: VariableMap;
  skipMissing: boolean;
};

export const EMPTY_AUDIENCE: AudienceState = {
  mode: "queue",
  queueId: "",
  base: "contacts",
  filters: [],
  variableMap: {},
  skipMissing: false,
};

export function audiencePayload(a: AudienceState) {
  if (a.mode === "queue" && a.queueId) return { type: "queue" as const, queue_id: a.queueId };
  if (a.mode === "filter")
    return {
      type: "filter" as const,
      base: a.base,
      filters: a.filters.filter((f) => f.value.trim()),
    };
  return undefined;
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
}: {
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
    JSON.stringify({ audience: payload, variable_map: value.variableMap }),
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
    <div className="space-y-4">
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
                    set({ base: b as AudienceBase, filters: [], variableMap: {} })
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
                    const conds = ((s?.filters as { conditions?: unknown[] })?.conditions ??
                      []) as {
                      field?: string;
                      op?: string;
                      value?: unknown;
                    }[];
                    set({
                      filters: conds
                        .filter((c) => c.field && typeof c.value === "string")
                        .map((c) => ({
                          column: c.field!,
                          op: (c.op as AudienceFilter["op"]) ?? "eq",
                          value: String(c.value),
                        })),
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
            {value.filters.map((f, i) => {
              const def = FILTER_FIELDS[value.base].find((d) => d.column === f.column);
              const upd = (patch: Partial<AudienceFilter>) =>
                set({ filters: value.filters.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={f.column}
                    onValueChange={(c) => {
                      const d = FILTER_FIELDS[value.base].find((x) => x.column === c);
                      upd({
                        column: c,
                        op: d?.kind === "text" ? "ilike" : d?.kind === "date" ? "gte" : "eq",
                        value: "",
                      });
                    }}
                  >
                    <SelectTrigger className="w-40" aria-label="Campo do filtro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_FIELDS[value.base].map((d) => (
                        <SelectItem key={d.column} value={d.column}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {def?.kind === "text" && (
                    <Select
                      value={f.op}
                      onValueChange={(o) => upd({ op: o as AudienceFilter["op"] })}
                    >
                      <SelectTrigger className="w-32" aria-label="Condição">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ilike">contém</SelectItem>
                        <SelectItem value="eq">é igual a</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {def?.kind === "date" && (
                    <Select
                      value={f.op}
                      onValueChange={(o) => upd({ op: o as AudienceFilter["op"] })}
                    >
                      <SelectTrigger className="w-32" aria-label="Condição">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gte">a partir de</SelectItem>
                        <SelectItem value="lte">até</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {def?.kind === "enum" || def?.kind === "member" ? (
                    <Select value={f.value} onValueChange={(v) => upd({ value: v })}>
                      <SelectTrigger className="w-48" aria-label="Valor do filtro">
                        <SelectValue placeholder="Escolha" />
                      </SelectTrigger>
                      <SelectContent>
                        {(def.kind === "enum"
                          ? (def.options ?? [])
                          : (members.data ?? []).map((m) => ({
                              value: m.user_id,
                              label: m.full_name || "Sem nome",
                            }))
                        ).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="w-48"
                      aria-label="Valor do filtro"
                      type={def?.kind === "date" ? "date" : "text"}
                      value={f.value}
                      onChange={(e) => upd({ value: e.target.value })}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover filtro"
                    onClick={() => set({ filters: value.filters.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={value.filters.length >= 10}
                onClick={() => {
                  const d = FILTER_FIELDS[value.base][0];
                  set({
                    filters: [
                      ...value.filters,
                      { column: d.column, op: d.kind === "text" ? "ilike" : "eq", value: "" },
                    ],
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar filtro
              </Button>
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
                        filters: {
                          type: "group",
                          op: "and",
                          conditions: value.filters
                            .filter((f) => f.value.trim())
                            .map((f) => ({
                              type: "condition",
                              field: f.column,
                              op: f.op,
                              value: f.value,
                            })),
                        },
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
                  inválido · {p.excluded.duplicate} duplicado · {p.excluded.opted_out} descadastrado
                </div>
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
                <Input
                  aria-label={`Valor se vazio para a variável ${k}`}
                  placeholder="Valor se vazio (opcional)"
                  value={value.variableMap[k]?.fallback ?? ""}
                  onChange={(e) => setVar(k, { fallback: e.target.value })}
                />
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
    </div>
  );
}
