/**
 * Campos de entidades (Lead/Empresa/Contato) exibidos na tela de qualificação.
 *
 * O layout é configurado por questionário (`field_layout`) e os campos são
 * editáveis: as alterações são gravadas no registro da respectiva entidade
 * ao salvar rascunho ou concluir a qualificação.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  entityLabel,
  type QualificationField,
  type QualificationFieldBlock,
  type QualificationFieldEntity,
} from "@/lib/prospecting/field-layout";

type Row = Record<string, unknown> | null;
type Records = Record<QualificationFieldEntity, Row>;
type Values = Record<QualificationFieldEntity, Record<string, unknown>>;

const EMPTY_VALUES: Values = { leads: {}, companies: {}, contacts: {} };

/** Sugestões de enriquecimento por entidade/coluna (ex.: Apollo.io). */
export type EntitySuggestions = Partial<Record<QualificationFieldEntity, Record<string, unknown>>>;

function isEmpty(v: unknown) {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/**
 * Carrega os registros necessários (lead + empresa/contato vinculados) e
 * mantém o estado editável dos campos configurados.
 */
export function useQualificationEntityFields(leadId: string, blocks: QualificationFieldBlock[]) {
  const entities = useMemo(() => {
    const set = new Set<QualificationFieldEntity>();
    for (const b of blocks) if (b.fields.length > 0) set.add(b.entity);
    return set;
  }, [blocks]);

  const needsLead = entities.size > 0; // lead é sempre necessário para resolver os vínculos

  const { data, isLoading, error } = useQuery({
    queryKey: ["qualification-entity-records", leadId, [...entities].sort().join(",")],
    enabled: needsLead,
    queryFn: async (): Promise<Records> => {
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (leadErr) throw new Error(leadErr.message);
      const records: Records = { leads: (lead as Row) ?? null, companies: null, contacts: null };
      const companyId = (lead as { company_id?: string | null } | null)?.company_id ?? null;
      const contactId =
        (lead as { converted_contact_id?: string | null } | null)?.converted_contact_id ?? null;
      if (entities.has("companies") && companyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .maybeSingle();
        records.companies = (company as Row) ?? null;
      }
      if (entities.has("contacts") && contactId) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactId)
          .maybeSingle();
        records.contacts = (contact as Row) ?? null;
      }
      return records;
    },
  });

  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  // Espelho síncrono dos valores, usado pelo preenchimento automático.
  const valuesRef = useRef<Values>(EMPTY_VALUES);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // Sincroniza os valores editáveis quando os registros carregam.
  // Blocos de entidades ainda sem registro vinculado começam vazios e
  // permanecem editáveis: o registro é criado e vinculado ao salvar.
  useEffect(() => {
    if (!data) return;
    const next: Values = { leads: {}, companies: {}, contacts: {} };
    for (const b of blocks) {
      const row = data[b.entity];
      for (const f of b.fields) {
        next[b.entity][f.key] = row ? (row[f.key] ?? null) : null;
      }
    }
    setValues(next);
  }, [data, blocks]);

  // Campos preenchidos automaticamente pelo enriquecimento (para exibir o selo).
  const [autofilled, setAutofilled] = useState<Record<string, boolean>>({});

  const setValue = (entity: QualificationFieldEntity, key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [entity]: { ...prev[entity], [key]: value } }));
    setAutofilled((prev) => ({ ...prev, [`${entity}.${key}`]: false }));
  };

  /**
   * Preenche automaticamente apenas os campos configurados que estão vazios,
   * marcando-os com o selo de origem. Campos já preenchidos ficam como
   * sugestão para o usuário aplicar manualmente.
   */
  const applySuggestions = useCallback(
    (suggestions: EntitySuggestions) => {
      const current = valuesRef.current;
      const next: Values = {
        leads: { ...current.leads },
        companies: { ...current.companies },
        contacts: { ...current.contacts },
      };
      const filled: string[] = [];
      for (const b of blocks) {
        const sugg = suggestions[b.entity];
        if (!sugg) continue;
        for (const f of b.fields) {
          const value = sugg[f.key];
          if (value === null || value === undefined || value === "") continue;
          if (!isEmpty(next[b.entity][f.key])) continue;
          next[b.entity][f.key] = value;
          filled.push(`${b.entity}.${f.key}`);
        }
      }
      if (filled.length === 0) return 0;
      valuesRef.current = next;
      setValues(next);
      setAutofilled((prev) => {
        const merged = { ...prev };
        for (const k of filled) merged[k] = true;
        return merged;
      });
      return filled.length;
    },
    [blocks],
  );

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const b of blocks) {
      for (const f of b.fields) {
        if (!f.required) continue;
        if (isEmpty(values[b.entity]?.[f.key])) missing.push(f.label);
      }
    }
    return missing;
  }, [blocks, values]);

  /**
   * Persiste os campos alterados em cada entidade. Quando o bloco é de
   * Empresa/Contato e o lead ainda não tem o vínculo, o registro é criado a
   * partir dos dados do lead + campos preenchidos e vinculado ao lead.
   */
  const saveAll = async () => {
    if (!data) return;
    const lead = data.leads;
    const used = new Set<QualificationFieldEntity>(
      blocks.filter((b) => b.fields.length > 0).map((b) => b.entity),
    );
    const base = {
      owner_id: lead?.["owner_id"] ?? null,
      assigned_to: lead?.["assigned_to"] ?? null,
      workspace_id: lead?.["workspace_id"] ?? null,
    } as Record<string, unknown>;
    const withBase = (payload: Record<string, unknown>) => {
      const out = { ...payload };
      for (const [k, v] of Object.entries(base)) if (v != null) out[k] = v;
      return out;
    };

    const clean = (entity: QualificationFieldEntity) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values[entity] ?? {})) {
        if (isEmpty(value)) continue;
        out[key] = value;
      }
      return out;
    };

    const leadPatch: Record<string, unknown> = {};

    // --- Empresa: cria e vincula quando o lead ainda não tem company_id ---
    let companyId = (lead?.["company_id"] as string | null) ?? null;
    if (used.has("companies") && !data.companies) {
      const vals = clean("companies");
      const name =
        (vals["name"] as string | undefined) ?? (lead?.["company_name"] as string | undefined);
      if (name) {
        const { data: created, error: insErr } = await supabase
          .from("companies")
          .insert(withBase({ ...vals, name }) as never)
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        companyId = (created as { id: string }).id;
        leadPatch["company_id"] = companyId;
      }
    }

    // --- Contato: cria e vincula quando o lead ainda não tem contato ---
    if (used.has("contacts") && !data.contacts) {
      const vals = clean("contacts");
      const firstName =
        (vals["first_name"] as string | undefined) ??
        (lead?.["first_name"] as string | undefined) ??
        null;
      const hasSignal =
        Object.keys(vals).length > 0 || !!lead?.["email"] || !!lead?.["phone"];
      if (firstName && hasSignal) {
        const payload: Record<string, unknown> = {
          first_name: firstName,
          last_name: lead?.["last_name"] ?? null,
          email: lead?.["email"] ?? null,
          phone: lead?.["phone"] ?? null,
          job_title: lead?.["job_title"] ?? null,
          ...(companyId ? { company_id: companyId } : {}),
          ...vals,
        };
        const { data: created, error: insErr } = await supabase
          .from("contacts")
          .insert(withBase(payload) as never)
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        leadPatch["converted_contact_id"] = (created as { id: string }).id;
      }
    }

    // --- Atualiza os registros já existentes ---
    for (const entity of ["leads", "companies", "contacts"] as QualificationFieldEntity[]) {
      const row = data[entity];
      if (!row) continue;
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values[entity] ?? {})) {
        const current = row[key] ?? null;
        const next = value === "" ? null : value;
        if (JSON.stringify(current ?? null) !== JSON.stringify(next ?? null)) patch[key] = next;
      }
      if (Object.keys(patch).length === 0) continue;
      const id = row["id"] as string | undefined;
      if (!id) continue;
      const { error: upErr } = await supabase
        .from(entity)
        .update(patch as never)
        .eq("id", id);
      if (upErr) throw new Error(upErr.message);
    }

    // --- Vincula os registros recém-criados ao lead ---
    if (Object.keys(leadPatch).length > 0) {
      const { error: linkErr } = await supabase
        .from("leads")
        .update(leadPatch as never)
        .eq("id", leadId);
      if (linkErr) throw new Error(linkErr.message);
    }
  };

  return {
    records: data ?? null,
    values,
    setValue,
    saveAll,
    applySuggestions,
    autofilled,
    missingRequired,
    isLoading: needsLead && isLoading,
    error: error as Error | null,
  };
}

export function QualificationEntityBlocks({
  blocks,
  records,
  values,
  onChange,
  disabled,
  isLoading,
  suggestions,
  autofilled,
}: {
  blocks: QualificationFieldBlock[];
  records: Records | null;
  values: Values;
  onChange: (entity: QualificationFieldEntity, key: string, value: unknown) => void;
  disabled?: boolean;
  isLoading?: boolean;
  suggestions?: EntitySuggestions;
  autofilled?: Record<string, boolean>;
}) {
  const visible = blocks.filter((b) => b.fields.length > 0);
  if (visible.length === 0) return null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {visible.map((b) => (
          <div key={b.id} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((b) => {
        const row = records?.[b.entity] ?? null;
        return (
          <section
            key={b.id}
            className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {b.title}
              </h3>
              {!row && b.entity !== "leads" ? (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium">
                  {entityLabel(b.entity)} será criado(a) e vinculado(a) ao salvar
                </Badge>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {b.fields.map((f) => (
                <EntityFieldInput
                  key={`${b.entity}.${f.key}`}
                  field={f}
                  value={values[b.entity]?.[f.key]}
                  disabled={disabled}
                  suggestion={suggestions?.[b.entity]?.[f.key]}
                  autofilled={autofilled?.[`${b.entity}.${f.key}`] === true}
                  onChange={(v) => onChange(b.entity, f.key, v)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EntityFieldInput({
  field,
  value,
  onChange,
  disabled,
  suggestion,
  autofilled,
}: {
  field: QualificationField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  suggestion?: unknown;
  autofilled?: boolean;
}) {
  const id = `qf-${field.key}`;
  const label = (
    <Label htmlFor={id} className="flex items-center gap-1.5 text-xs">
      <span>
        {field.label}
        {field.required ? <span className="text-destructive ml-1">*</span> : null}
      </span>
      {autofilled ? (
        <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px] font-medium">
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          Apollo
        </Badge>
      ) : null}
    </Label>
  );

  const showSuggestion =
    !autofilled &&
    suggestion !== null &&
    suggestion !== undefined &&
    suggestion !== "" &&
    String(suggestion) !== String(value ?? "");

  const suggestionHint = showSuggestion ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => onChange(suggestion)}
      className="h-6 justify-start gap-1 px-1 text-[11px] text-muted-foreground hover:text-foreground"
      title={`Aplicar sugestão do Apollo.io: ${String(suggestion)}`}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      <span className="truncate">Apollo: {String(suggestion)}</span>
    </Button>
  ) : null;

  if (field.type === "boolean") {
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(v) => onChange(v === true)}
          />
          <span className="text-sm">Sim</span>
        </div>
        {suggestionHint}
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div className="space-y-1.5">
        {label}
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {suggestionHint}
      </div>
    );
  }

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  const raw =
    field.type === "date" && typeof value === "string" ? value.slice(0, 10) : (value ?? "");

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={id}
        type={inputType}
        disabled={disabled}
        value={raw as string | number}
        onChange={(e) =>
          onChange(
            field.type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
      {suggestionHint}
    </div>
  );
}
