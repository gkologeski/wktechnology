// Construtor de público estilo "Listas/Segmentos" do HubSpot.
// 3 abas: Construtor inline (grupos AND/OR), Listas salvas, IDs manuais.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Eye, Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { EMPTY_FILTER, type FilterCondition, type FilterGroup, type FilterOp } from "@/lib/filters";
import {
  previewAudience,
  type AudienceRule,
  type AudienceSource,
  type ResolvedAudience,
} from "@/lib/prospecting-audience.functions";
import { listSegments } from "@/lib/segments.functions";

type FieldDef = { name: string; label: string; type?: "text" | "number" | "date" | "select"; options?: { value: string; label: string }[] };

type EntitySource = Exclude<AudienceSource, "manual" | "segment">;

const ENTITY_LABEL: Record<EntitySource, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas → contatos",
  deals: "Negócios → contatos",
};

const FIELDS_BY_ENTITY: Record<EntitySource, FieldDef[]> = {
  leads: [
    { name: "status", label: "Status", type: "select", options: [
      { value: "new", label: "Novo" }, { value: "contacted", label: "Contatado" },
      { value: "qualified", label: "Qualificado" }, { value: "disqualified", label: "Desqualificado" },
    ]},
    { name: "source", label: "Origem", type: "text" },
    { name: "score", label: "Score", type: "number" },
    { name: "company_name", label: "Empresa", type: "text" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
  contacts: [
    { name: "lifecyclestage", label: "Lifecycle stage", type: "text" },
    { name: "job_title", label: "Cargo", type: "text" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "company_id", label: "Empresa (UUID)", type: "text" },
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
  companies: [
    { name: "industry", label: "Indústria", type: "text" },
    { name: "size", label: "Porte", type: "text" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "annualrevenue", label: "Receita anual", type: "number" },
    { name: "is_target_account", label: "Target account", type: "select", options: [
      { value: "true", label: "Sim" }, { value: "false", label: "Não" },
    ]},
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
  ],
  deals: [
    { name: "stage", label: "Etapa", type: "text" },
    { name: "stage_id", label: "Stage ID", type: "text" },
    { name: "pipeline_id", label: "Pipeline (UUID)", type: "text" },
    { name: "value", label: "Valor", type: "number" },
    { name: "currency", label: "Moeda", type: "text" },
    { name: "expected_close_date", label: "Fechamento esperado", type: "date" },
    { name: "company_id", label: "Empresa (UUID)", type: "text" },
  ],
};

const OPS_BY_TYPE: Record<string, { value: FilterOp; label: string }[]> = {
  text: [
    { value: "ilike", label: "contém" },
    { value: "eq", label: "é igual a" },
    { value: "neq", label: "é diferente de" },
    { value: "is_null", label: "é desconhecido" },
    { value: "is_not_null", label: "é conhecido" },
  ],
  select: [
    { value: "eq", label: "é" },
    { value: "neq", label: "não é" },
    { value: "is_null", label: "é desconhecido" },
    { value: "is_not_null", label: "é conhecido" },
  ],
  number: [
    { value: "eq", label: "é igual a" },
    { value: "neq", label: "é diferente de" },
    { value: "gt", label: "maior que" },
    { value: "gte", label: "maior ou igual a" },
    { value: "lt", label: "menor que" },
    { value: "lte", label: "menor ou igual a" },
    { value: "is_null", label: "é desconhecido" },
    { value: "is_not_null", label: "é conhecido" },
  ],
  date: [
    { value: "gte", label: "depois de" },
    { value: "lte", label: "antes de" },
    { value: "is_null", label: "é desconhecido" },
    { value: "is_not_null", label: "é conhecido" },
  ],
};

const opsFor = (t?: string) => OPS_BY_TYPE[t ?? "text"] ?? OPS_BY_TYPE.text;

function isEntitySource(s: AudienceSource): s is EntitySource {
  return s !== "manual" && s !== "segment";
}

function debounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function HubspotListBuilder({
  mode,
  rules,
  onChange,
  onModeChange,
}: {
  mode: "static" | "dynamic";
  rules: AudienceRule[];
  onChange: (rules: AudienceRule[]) => void;
  onModeChange: (mode: "static" | "dynamic") => void;
}) {
  // Determina aba inicial a partir das regras existentes
  const initialTab = useMemo<"builder" | "segments" | "manual">(() => {
    if (rules.some((r) => r.source === "segment")) return "segments";
    if (rules.some((r) => r.source === "manual") && !rules.some((r) => isEntitySource(r.source))) return "manual";
    return "builder";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<"builder" | "segments" | "manual">(initialTab);

  // Subconjuntos por aba
  const entityRules = rules.filter((r) => isEntitySource(r.source));
  const segmentRule = rules.find((r) => r.source === "segment");
  const manualRule = rules.find((r) => r.source === "manual");

  // Helpers para atualizar mantendo o restante intacto
  const setEntityRules = (next: AudienceRule[]) => {
    const others = rules.filter((r) => !isEntitySource(r.source));
    onChange([...next, ...others]);
  };
  const setSegmentRule = (next: AudienceRule | null) => {
    const others = rules.filter((r) => r.source !== "segment");
    onChange(next ? [...others, next] : others);
  };
  const setManualRule = (next: AudienceRule | null) => {
    const others = rules.filter((r) => r.source !== "manual");
    onChange(next ? [...others, next] : others);
  };

  // Preview ao vivo (debounced)
  const previewFn = useServerFn(previewAudience);
  const rulesKey = JSON.stringify(rules);
  const debouncedKey = debounce(rulesKey, 500);
  const preview = useQuery({
    queryKey: ["audience-preview", debouncedKey],
    enabled: rules.length > 0,
    queryFn: async () => previewFn({ data: { rules } }),
    staleTime: 30_000,
  });
  const [showSample, setShowSample] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Tipo de lista</Label>
        <Select value={mode} onValueChange={(v) => onModeChange(v as "static" | "dynamic")}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Estática — congela ao salvar</SelectItem>
            <SelectItem value="dynamic">Ativa — recalcula ao iniciar</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <PreviewBadge preview={preview.data} loading={preview.isFetching} onShowSample={() => setShowSample((s) => !s)} hasRules={rules.length > 0} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="builder">Construtor de filtros</TabsTrigger>
          <TabsTrigger value="segments">Listas salvas</TabsTrigger>
          <TabsTrigger value="manual">IDs manuais</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="pt-3">
          <InlineBuilder rules={entityRules} onChange={setEntityRules} />
        </TabsContent>

        <TabsContent value="segments" className="pt-3">
          <SegmentPicker value={segmentRule?.segment_id ?? null} onChange={(id) => setSegmentRule(id ? { source: "segment", segment_id: id } : null)} />
        </TabsContent>

        <TabsContent value="manual" className="pt-3">
          <ManualEditor ids={manualRule?.lead_ids ?? []} onChange={(ids) => setManualRule(ids.length ? { source: "manual", lead_ids: ids } : null)} />
        </TabsContent>
      </Tabs>

      {showSample && preview.data && (
        <SamplePanel data={preview.data} />
      )}
    </div>
  );
}

function PreviewBadge({ preview, loading, onShowSample, hasRules }: {
  preview: ResolvedAudience | undefined;
  loading: boolean;
  onShowSample: () => void;
  hasRules: boolean;
}) {
  if (!hasRules) return <span className="text-xs text-muted-foreground">Sem filtros</span>;
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        {loading ? "Calculando…" : `${preview?.total ?? 0} leads correspondem`}
      </Badge>
      <Button type="button" size="sm" variant="ghost" onClick={onShowSample} disabled={!preview || preview.total === 0}>
        <Eye className="h-3.5 w-3.5 mr-1" />Ver amostra
      </Button>
    </div>
  );
}

function SamplePanel({ data }: { data: ResolvedAudience }) {
  return (
    <Card className="p-3 bg-muted/40">
      <div className="text-xs text-muted-foreground mb-2">
        Distribuição: {data.per_rule.map((r, i) => (
          <span key={i} className="mr-3">{r.source}: {r.matched}→{r.resolved_leads}</span>
        ))}
      </div>
      {data.sample.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma amostra disponível.</p>
      ) : (
        <ul className="text-xs space-y-1 max-h-56 overflow-y-auto">
          {data.sample.map((s) => (
            <li key={s.id} className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">{s.source}</Badge>
              <span className="truncate flex-1">{s.name}</span>
              <span className="text-muted-foreground">{s.phone ?? "sem telefone"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Inline builder com grupos AND/OR ----------

function InlineBuilder({ rules, onChange }: { rules: AudienceRule[]; onChange: (r: AudienceRule[]) => void }) {
  const addGroup = () => {
    onChange([...rules, { source: "leads", filter: { ...EMPTY_FILTER } }]);
  };
  const updateGroup = (i: number, next: AudienceRule) =>
    onChange(rules.map((r, idx) => (idx === i ? next : r)));
  const removeGroup = (i: number) =>
    onChange(rules.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <Card className="p-6 text-center border-dashed">
          <p className="text-sm text-muted-foreground mb-3">
            Nenhum grupo de filtros. Crie um grupo para começar a montar seu público.
          </p>
          <Button type="button" size="sm" onClick={addGroup}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar grupo de filtros
          </Button>
        </Card>
      )}

      {rules.map((rule, i) => {
        if (!isEntitySource(rule.source)) return null;
        return (
          <div key={i}>
            <FilterGroupCard
              rule={rule as AudienceRule & { source: EntitySource }}
              onChange={(r) => updateGroup(i, r)}
              onRemove={() => removeGroup(i)}
            />
            {i < rules.length - 1 && (
              <div className="flex items-center gap-2 my-2 px-2">
                <div className="flex-1 h-px bg-border" />
                <Badge variant="outline" className="font-semibold">OU</Badge>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
          </div>
        );
      })}

      {rules.length > 0 && (
        <Button type="button" size="sm" variant="outline" onClick={addGroup} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" />Adicionar grupo (OU)
        </Button>
      )}
    </div>
  );
}

function FilterGroupCard({
  rule, onChange, onRemove,
}: {
  rule: AudienceRule & { source: EntitySource };
  onChange: (r: AudienceRule) => void;
  onRemove: () => void;
}) {
  const fields = FIELDS_BY_ENTITY[rule.source];
  const filter = (rule.filter ?? EMPTY_FILTER) as FilterGroup;
  const conds = filter.conditions.filter((c): c is FilterCondition => c.type === "condition");

  const setFilter = (next: FilterGroup) => onChange({ ...rule, filter: next });

  const addCondition = () => {
    const f = fields[0];
    const op = opsFor(f.type)[0].value;
    const nextConds: FilterCondition[] = [...conds, { type: "condition", field: f.name, op, value: "" }];
    setFilter({ ...filter, op: "and", conditions: nextConds });
  };

  const updateCond = (idx: number, next: FilterCondition) => {
    const nextConds = conds.map((c, i) => (i === idx ? next : c));
    setFilter({ ...filter, conditions: nextConds });
  };

  const removeCond = (idx: number) => {
    const nextConds = conds.filter((_, i) => i !== idx);
    setFilter({ ...filter, conditions: nextConds });
  };

  return (
    <Card className="p-3 space-y-2 border-l-4 border-l-primary/40">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Fonte</Label>
        <Select
          value={rule.source}
          onValueChange={(v) => {
            const source = v as EntitySource;
            // Ao mudar a fonte, reseta as condições (campos mudam).
            onChange({ source, filter: { ...EMPTY_FILTER } });
          }}
        >
          <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ENTITY_LABEL) as EntitySource[]).map((s) => (
              <SelectItem key={s} value={s}>{ENTITY_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{conds.length} condição(ões)</Badge>
        <div className="flex-1" />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} title="Remover grupo">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {conds.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sem condições — este grupo inclui todos os registros da fonte.</p>
      )}

      <div className="space-y-1.5">
        {conds.map((c, idx) => {
          const field = fields.find((f) => f.name === c.field) ?? fields[0];
          const ops = opsFor(field.type);
          const needsValue = !["is_null", "is_not_null"].includes(c.op);
          return (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex items-center gap-2 my-1 pl-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">E</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Select
                  value={c.field}
                  onValueChange={(v) => {
                    const newField = fields.find((f) => f.name === v) ?? fields[0];
                    const newOp = opsFor(newField.type)[0].value;
                    updateCond(idx, { ...c, field: v, op: newOp, value: "" });
                  }}
                >
                  <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={c.op} onValueChange={(v) => updateCond(idx, { ...c, op: v as FilterOp })}>
                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ops.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsValue && (
                  field.type === "select" && field.options ? (
                    <Select value={String(c.value ?? "")} onValueChange={(v) => updateCond(idx, { ...c, value: v })}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Valor" /></SelectTrigger>
                      <SelectContent>
                        {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-8 flex-1"
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      value={String(c.value ?? "")}
                      onChange={(e) => updateCond(idx, { ...c, value: e.target.value })}
                      placeholder="Valor"
                    />
                  )
                )}
                <Button type="button" size="icon" variant="ghost" onClick={() => removeCond(idx)} title="Remover condição">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" size="sm" variant="ghost" onClick={addCondition} className="text-primary">
        <Plus className="h-3.5 w-3.5 mr-1" />E condição
      </Button>
    </Card>
  );
}

// ---------- Listas salvas ----------

type SegmentRow = { id: string; name: string; entity: string; kind: string; member_count: number };

function SegmentPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const listFn = useServerFn(listSegments);
  const q = useQuery({
    queryKey: ["segments"],
    queryFn: async () => (await listFn()).segments as SegmentRow[],
  });

  const selected = q.data?.find((s) => s.id === value) ?? null;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Lista salva</Label>
        <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={q.isLoading ? "Carregando…" : "Selecione uma lista"} />
          </SelectTrigger>
          <SelectContent>
            {(q.data ?? []).length === 0 && (
              <div className="p-2 text-xs text-muted-foreground">Nenhuma lista criada ainda.</div>
            )}
            {q.data?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.entity} · {s.member_count} membros
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Limpar
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {selected
            ? `${selected.member_count} membros · tipo ${selected.kind === "dynamic" ? "ativa" : "estática"}`
            : "As listas salvas vêm de Configurações → Listas."}
        </span>
        <Button type="button" asChild size="sm" variant="link">
          <Link to="/settings/segments">
            <ExternalLink className="h-3 w-3 mr-1" />Gerenciar listas
          </Link>
        </Button>
      </div>
    </Card>
  );
}

// ---------- IDs manuais ----------

function ManualEditor({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Card className="p-3 space-y-2">
      <Label className="text-sm">IDs de leads (UUIDs)</Label>
      <Textarea
        rows={6}
        placeholder="Cole UUIDs de leads — um por linha"
        value={ids.join("\n")}
        onChange={(e) => {
          const next = e.target.value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
          onChange(next);
        }}
        onBlur={() => {
          const invalid = ids.filter((id) => !/^[0-9a-f-]{36}$/i.test(id));
          if (invalid.length) toast.warning(`${invalid.length} ID(s) com formato inválido`);
        }}
      />
      <p className="text-xs text-muted-foreground">{ids.length} ID(s)</p>
    </Card>
  );
}
