/**
 * Campos de entidades (Lead/Empresa/Contato) exibidos na tela de qualificação.
 *
 * O layout é configurado por questionário (`field_layout`) e os campos são
 * editáveis: as alterações são gravadas no registro da respectiva entidade
 * ao salvar rascunho ou concluir a qualificação.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Sincroniza os valores editáveis quando os registros carregam.
  useEffect(() => {
    if (!data) return;
    const next: Values = { leads: {}, companies: {}, contacts: {} };
    for (const b of blocks) {
      const row = data[b.entity];
      if (!row) continue;
      for (const f of b.fields) {
        next[b.entity][f.key] = row[f.key] ?? null;
      }
    }
    setValues(next);
  }, [data, blocks]);

  const setValue = (entity: QualificationFieldEntity, key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [entity]: { ...prev[entity], [key]: value } }));
  };

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const b of blocks) {
      if (!data?.[b.entity]) continue;
      for (const f of b.fields) {
        if (!f.required) continue;
        if (isEmpty(values[b.entity]?.[f.key])) missing.push(f.label);
      }
    }
    return missing;
  }, [blocks, values, data]);

  /** Persiste apenas os campos alterados em cada entidade. */
  const saveAll = async () => {
    if (!data) return;
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
  };

  return {
    records: data ?? null,
    values,
    setValue,
    saveAll,
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
}: {
  blocks: QualificationFieldBlock[];
  records: Records | null;
  values: Values;
  onChange: (entity: QualificationFieldEntity, key: string, value: unknown) => void;
  disabled?: boolean;
  isLoading?: boolean;
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {b.title}
            </h3>
            {!row ? (
              <p className="text-xs text-muted-foreground">
                Nenhum registro de {entityLabel(b.entity).toLowerCase()} vinculado a este lead.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {b.fields.map((f) => (
                  <EntityFieldInput
                    key={`${b.entity}.${f.key}`}
                    field={f}
                    value={values[b.entity]?.[f.key]}
                    disabled={disabled}
                    onChange={(v) => onChange(b.entity, f.key, v)}
                  />
                ))}
              </div>
            )}
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
}: {
  field: QualificationField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const id = `qf-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-xs">
      {field.label}
      {field.required ? <span className="text-destructive ml-1">*</span> : null}
    </Label>
  );

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
    </div>
  );
}
