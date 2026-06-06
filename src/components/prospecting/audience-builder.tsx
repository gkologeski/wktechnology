// Builder de público multi-entidade para campanhas de prospecção.
// Permite combinar regras de filtragem em leads/contacts/companies/deals + lista manual.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Eye, Filter } from "lucide-react";
import { toast } from "sonner";
import { FilterBuilderDialog } from "@/components/filter-builder-dialog";
import { EMPTY_FILTER, type FilterGroup } from "@/lib/filters";
import {
  previewAudience,
  type AudienceRule,
  type AudienceSource,
  type ResolvedAudience,
} from "@/lib/prospecting-audience.functions";

const SOURCE_LABEL: Record<AudienceSource, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas → contatos",
  deals: "Deals → contatos",
  manual: "Lista manual (UUIDs)",
};

const FIELDS_BY_SOURCE: Record<AudienceSource, Array<{ name: string; label: string; type?: string }>> = {
  leads: [
    { name: "status", label: "Status", type: "select" },
    { name: "source", label: "Origem", type: "text" },
    { name: "score", label: "Score", type: "number" },
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
    { name: "created_at", label: "Criado em", type: "date" },
    { name: "company_name", label: "Empresa (texto)", type: "text" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
  ],
  contacts: [
    { name: "lifecyclestage", label: "Lifecycle stage", type: "text" },
    { name: "job_title", label: "Cargo", type: "text" },
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
    { name: "created_at", label: "Criado em", type: "date" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "company_id", label: "Company ID (UUID)", type: "text" },
  ],
  companies: [
    { name: "industry", label: "Indústria", type: "text" },
    { name: "size", label: "Porte", type: "text" },
    { name: "state", label: "Estado", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "annualrevenue", label: "Receita anual", type: "number" },
    { name: "is_target_account", label: "Target account", type: "select" },
    { name: "assigned_user_id", label: "Responsável (UUID)", type: "text" },
  ],
  deals: [
    { name: "stage", label: "Stage", type: "text" },
    { name: "stage_id", label: "Stage ID", type: "text" },
    { name: "pipeline_id", label: "Pipeline (UUID)", type: "text" },
    { name: "value", label: "Valor", type: "number" },
    { name: "currency", label: "Moeda", type: "text" },
    { name: "expected_close_date", label: "Fechamento esperado", type: "date" },
    { name: "company_id", label: "Company ID (UUID)", type: "text" },
  ],
  manual: [],
};

export function AudienceBuilder({
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
  const previewFn = useServerFn(previewAudience);
  const [editing, setEditing] = useState<{ index: number } | null>(null);
  const [preview, setPreview] = useState<ResolvedAudience | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const addRule = () =>
    onChange([...rules, { source: "leads", filter: EMPTY_FILTER }]);

  const updateRule = (i: number, next: AudienceRule) =>
    onChange(rules.map((r, idx) => (idx === i ? next : r)));

  const removeRule = (i: number) =>
    onChange(rules.filter((_, idx) => idx !== i));

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const out = await previewFn({ data: { rules } });
      setPreview(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na pré-visualização");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Modo</Label>
        <Select value={mode} onValueChange={(v) => onModeChange(v as "static" | "dynamic")}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Snapshot (congela ao salvar)</SelectItem>
            <SelectItem value="dynamic">Dinâmica (recalcula ao iniciar)</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={addRule}>
          <Plus className="h-3.5 w-3.5 mr-1" />Adicionar fonte
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={runPreview} disabled={previewing || rules.length === 0}>
          <Eye className="h-3.5 w-3.5 mr-1" />Pré-visualizar
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma fonte. Use "Adicionar fonte" para combinar filtros em diferentes entidades.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule, i) => {
          const condCount =
            rule.source === "manual"
              ? (rule.lead_ids?.length ?? 0)
              : (rule.filter?.conditions.length ?? 0);
          return (
            <Card key={i} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={rule.source}
                  onValueChange={(v) => {
                    const source = v as AudienceSource;
                    if (source === "manual") {
                      updateRule(i, { source, lead_ids: rule.lead_ids ?? [] });
                    } else {
                      updateRule(i, { source, filter: rule.filter ?? EMPTY_FILTER });
                    }
                  }}
                >
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOURCE_LABEL) as AudienceSource[]).map((s) => (
                      <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="secondary">{condCount} {rule.source === "manual" ? "id(s)" : "condição(ões)"}</Badge>
                <div className="flex-1" />
                {rule.source !== "manual" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ index: i })}>
                    <Filter className="h-3.5 w-3.5 mr-1" />Editar filtros
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" onClick={() => removeRule(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {rule.source === "manual" && (
                <Textarea
                  rows={3}
                  placeholder="Cole UUIDs de leads, um por linha"
                  value={(rule.lead_ids ?? []).join("\n")}
                  onChange={(e) => {
                    const ids = e.target.value
                      .split(/\s+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    updateRule(i, { source: "manual", lead_ids: ids });
                  }}
                />
              )}

              {rule.source !== "manual" && rule.filter && rule.filter.conditions.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Combinação: {rule.filter.op.toUpperCase()} ·{" "}
                  {rule.filter.conditions
                    .map((c) => (c.type === "condition" ? `${c.field} ${c.op}` : "(grupo)"))
                    .join(", ")}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {preview && (
        <Card className="p-3 bg-muted/40">
          <div className="text-sm font-medium mb-1">
            Pré-visualização: {preview.total} lead(s) resultante(s)
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {preview.per_rule.map((r, idx) => (
              <span key={idx} className="mr-3">
                {SOURCE_LABEL[r.source]}: {r.matched} → {r.resolved_leads}
              </span>
            ))}
          </div>
          {preview.sample.length > 0 && (
            <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
              {preview.sample.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="text-muted-foreground">[{s.source}]</span>
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground">{s.phone ?? "sem telefone"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editing !== null && (() => {
        const rule = rules[editing.index];
        if (!rule || rule.source === "manual") return null;
        const fields = FIELDS_BY_SOURCE[rule.source];
        return (
          <FilterBuilderDialog
            open={true}
            setOpen={(b) => { if (!b) setEditing(null); }}
            fields={fields}
            value={(rule.filter ?? EMPTY_FILTER) as FilterGroup}
            onApply={(g) => {
              updateRule(editing.index, { ...rule, filter: g });
              setEditing(null);
            }}
          />
        );
      })()}
    </div>
  );
}
