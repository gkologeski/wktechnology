import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, Pencil, Database, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PropertyHistoryDrawer } from "@/components/property-history-drawer";
import {
  listCustomProperties,
  setCustomFieldValue,
  computeAiProperty,
  type CustomEntity,
} from "@/lib/custom-properties.functions";
import {
  getRecordLayout,
  type LayoutSection,
  type RecordEntity,
} from "@/lib/record-layouts.functions";
import { toE164, isEmail, isCNPJ, formatCNPJ, stripCNPJ } from "@/lib/validators";
import { CompanyPicker, type CompanyPickerValue } from "@/components/ui/company-picker";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { formatDateOnly, formatDateTime } from "@/lib/crm";
import { formatMoney, isMoneyField, resolveCurrency } from "@/lib/format/money-fields";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";

import { CurrencyInput } from "@/components/ui/currency-input";

import { OwnerField } from "@/components/entity/owner-field";
import { AssigneeField } from "@/components/entity/assignee-field";
import { CreatorField } from "@/components/entity/creator-field";
import { creatorId, responsibleId } from "@/lib/entity/responsible";

// E.164-compliant chars only: digits, leading +, plus visual separators.
const PHONE_INPUT_RE = /[^\d+\s\-()]/g;
function sanitizePhoneInput(s: string): string {
  return s.replace(PHONE_INPUT_RE, "");
}
// BR phone mask: (99) 9999-9999 / (99) 99999-9999. Strips +55 prefix.
// Returns the original string for non-BR numbers (kept in E.164).
function formatBrPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  let digits = s.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 0 && digits.length < 10) {
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return s;
}
// Apply mask while editing only when the user is typing a BR-style number
// (no leading "+"); preserve international input as-is.
function formatPhoneInput(s: string): string {
  const cleaned = sanitizePhoneInput(s);
  if (cleaned.trim().startsWith("+")) return cleaned;
  return formatBrPhone(cleaned);
}
// Email: no whitespace allowed.
function sanitizeEmailInput(s: string): string {
  return s.replace(/\s+/g, "");
}
// CEP: digits only, max 8, formatted as 99999-999.
function formatCep(s: string): string {
  const d = (s ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
// CNPJ: keep only digits (max 14) while typing, showing progressive mask.
function formatCnpjInput(s: string): string {
  const d = (s ?? "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export type PropDef = {
  key: string;
  label: string;
  primary?: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
  type?:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "url"
    | "company"
    | "cep"
    | "cnpj"
    | "currency"
    | "date"
    | "datetime";
};

// Heurísticas para auto-detectar tipo de exibição quando o caller não definir.
function inferDisplayType(key: string): PropDef["type"] | undefined {
  const k = key.toLowerCase();
  if (k === "currency" || k === "moeda") return undefined;
  if (isMoneyField(k)) return "currency";
  if (k.endsWith("_at") || k === "created_at" || k === "updated_at" || k.endsWith("_datetime"))
    return "datetime";
  if (k.endsWith("_date") || k === "due_date" || k === "expected_close_date") return "date";
  return undefined;
}

function formatDisplayValue(
  type: PropDef["type"] | undefined,
  raw: unknown,
  row: Record<string, unknown>,
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (type === "currency") {
    return formatMoney(raw, resolveCurrency(row)) ?? String(raw);
  }
  if (type === "date") return formatDateOnly(String(raw));
  if (type === "datetime") return formatDateTime(String(raw));
  if (type === "number" && typeof raw === "number") return raw.toLocaleString("pt-BR");
  return String(raw);
}

type CustomProp = Awaited<ReturnType<typeof listCustomProperties>>[number];

export function PropertiesPanel<T extends Record<string, unknown> & { id: string }>({
  entity,
  table,
  row,
  props,
  onSaved,
}: {
  entity: string;
  table: string;
  row: T;
  props: PropDef[];
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [showHs, setShowHs] = useState(false);
  const [customDefs, setCustomDefs] = useState<CustomProp[]>([]);
  const [layoutSections, setLayoutSections] = useState<LayoutSection[] | null>(null);
  // Criação inline de empresa (usada tanto no edit inline quanto no "Ver todas").
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState("");
  const [pendingCompanyField, setPendingCompanyField] = useState<string | null>(null);
  const listCustomFn = useServerFn(listCustomProperties);
  const setCustomFn = useServerFn(setCustomFieldValue);
  const getLayoutFn = useServerFn(getRecordLayout);
  const customEntity = entity as CustomEntity;
  const isCustomEntity = ["leads", "contacts", "companies", "deals"].includes(entity);
  const customValues = ((row as Record<string, unknown>).custom_fields ?? {}) as Record<
    string,
    unknown
  >;

  const openCreateCompany = (field: string, name: string) => {
    setPendingCompanyField(field);
    setPendingCompanyName(name);
    setCreateCompanyOpen(true);
  };

  const handleCompanyCreated = async (companyId: string) => {
    const field = pendingCompanyField;
    const name = pendingCompanyName.trim();
    if (!field) return;
    const patch: Record<string, unknown> = { [field]: name || null };
    // Se o form usa o par company_name + company_id (leads/contacts/deals/tickets),
    // também grava o vínculo estruturado.
    if (field === "company_name") patch.company_id = companyId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: affected, error } = await (supabase as any)
      .from(table)
      .update(patch)
      .eq("id", row.id)
      .select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (deniedIfUnaffected(affected)) return;

    toast.success("Empresa vinculada");
    setValue(name);
    setEditing(null);
    setPendingCompanyField(null);
    onSaved?.();
  };

  useEffect(() => {
    if (!isCustomEntity) return;
    listCustomFn({ data: { entity: customEntity } })
      .then((d) => setCustomDefs(d.filter((p) => p.enabled)))
      .catch(() => {
        /* ignore */
      });
  }, [customEntity, isCustomEntity, listCustomFn]);

  useEffect(() => {
    if (!isCustomEntity) return;
    getLayoutFn({ data: { entity: customEntity as RecordEntity } })
      .then((r) => setLayoutSections(r.sections))
      .catch(() => {
        /* ignore */
      });
  }, [customEntity, isCustomEntity, getLayoutFn]);

  const saveCustom = async (key: string, val: unknown) => {
    try {
      await setCustomFn({
        data: { entity: customEntity, entity_id: row.id, key, value: val as never },
      });
      toast.success("Atualizado");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const hsRaw = (row as Record<string, unknown>).hs_raw as
    | { properties?: Record<string, unknown> }
    | null
    | undefined;
  const hsProps = hsRaw?.properties ?? null;
  const knownKeys = new Set(props.map((p) => p.key));
  const extraHsEntries = hsProps
    ? Object.entries(hsProps).filter(
        ([k, v]) => !knownKeys.has(k) && v !== null && v !== "" && v !== undefined,
      )
    : [];

  const primary = props.filter((p) => p.primary);
  const display = primary.length ? primary : props.slice(0, 8);
  const propsByKey = new Map(props.map((p) => [p.key, p]));
  const renderableSections: { title: string; items: PropDef[] }[] = (() => {
    if (!layoutSections || layoutSections.length === 0) return [];
    return layoutSections
      .map((s) => ({
        title: s.title,
        items: s.keys.map((k) => propsByKey.get(k)).filter((p): p is PropDef => !!p),
      }))
      .filter((s) => s.items.length > 0);
  })();
  const useSections = renderableSections.length > 0;

  const save = async (key: string) => {
    const def = props.find((p) => p.key === key);
    let toSave: string | null = value || null;
    if (def?.type === "tel" && toSave) {
      const normalized = toE164(toSave);
      if (!normalized) {
        toast.error("Telefone inválido. Use o formato E.164 (ex.: +5511999998888).");
        return;
      }
      toSave = normalized;
    }
    if (def?.type === "email" && toSave) {
      toSave = toSave.trim();
      if (!isEmail(toSave)) {
        toast.error("Email inválido.");
        return;
      }
    }
    if (def?.type === "cep" && toSave) {
      const digits = toSave.replace(/\D/g, "");
      if (digits.length !== 8) {
        toast.error("CEP inválido. Use 8 dígitos (99999-999).");
        return;
      }
      toSave = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    if (def?.type === "cnpj" && toSave) {
      const digits = stripCNPJ(toSave);
      if (!isCNPJ(digits)) {
        toast.error("CNPJ inválido.");
        return;
      }
      toSave = digits;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(table)
      .update({ [key]: toSave })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Atualizado");
      setEditing(null);
      onSaved?.();
    }
  };

  const renderField = (raw0: PropDef) => {
    // Resolve o tipo de exibição uma única vez (inclui a heurística de moeda),
    // para que leitura e edição usem o mesmo tratamento.
    const p: PropDef = { ...raw0, type: raw0.type ?? inferDisplayType(raw0.key) };
    return (
      <div key={p.key} className="group">
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
          {p.label}
        </label>
        {editing === p.key ? (
          p.options ? (
            <div className="flex gap-1">
              <Select
                value={value}
                onValueChange={async (v) => {
                  setValue(v);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { error } = await (supabase as any)
                    .from(table)
                    .update({ [p.key]: v })
                    .eq("id", row.id);
                  if (error) toast.error(error.message);
                  else {
                    toast.success("Atualizado");
                    setEditing(null);
                    onSaved?.();
                  }
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {p.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          ) : p.type === "company" ? (
            <div className="space-y-2">
              <CompanyPicker
                value={{ id: null, name: value }}
                onChange={(v: CompanyPickerValue) => setValue(v.name)}
                onCreateNew={(name) => openCreateCompany(p.key, name)}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-8" onClick={() => save(p.key)}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : p.type === "currency" ? (
            <div className="flex gap-1">
              <CurrencyInput
                autoFocus
                aria-label={p.label}
                currency={resolveCurrency(row)}
                value={value === "" ? null : value}
                onValueChange={(n) => setValue(n === null ? "" : String(n))}
                onKeyDown={(e) => e.key === "Enter" && save(p.key)}
                className="h-8 text-right"
              />
              <Button size="sm" className="h-8" onClick={() => save(p.key)}>
                OK
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              <Input
                autoFocus
                type={
                  p.type === "cep" || p.type === "cnpj"
                    ? "text"
                    : p.type === "datetime"
                      ? "datetime-local"
                      : (p.type ?? "text")
                }
                inputMode={
                  p.type === "tel"
                    ? "tel"
                    : p.type === "cep" || p.type === "cnpj"
                      ? "numeric"
                      : undefined
                }
                maxLength={p.type === "cep" ? 9 : p.type === "cnpj" ? 18 : undefined}
                placeholder={
                  p.type === "cep"
                    ? "99999-999"
                    : p.type === "cnpj"
                      ? "00.000.000/0000-00"
                      : p.type === "tel"
                        ? "(11) 99999-8888"
                        : undefined
                }
                value={value}
                onChange={(e) =>
                  setValue(
                    p.type === "tel"
                      ? formatPhoneInput(e.target.value)
                      : p.type === "email"
                        ? sanitizeEmailInput(e.target.value)
                        : p.type === "cep"
                          ? formatCep(e.target.value)
                          : p.type === "cnpj"
                            ? formatCnpjInput(e.target.value)
                            : e.target.value,
                  )
                }
                onKeyDown={(e) => e.key === "Enter" && save(p.key)}
                className="h-8"
              />
              <Button size="sm" className="h-8" onClick={() => save(p.key)}>
                OK
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span
              className="text-sm text-foreground break-words min-w-0 flex-1"
              title={(() => {
                const dt = p.type ?? inferDisplayType(p.key);
                if (dt !== "currency") return undefined;
                return (
                  formatMoney(row[p.key], resolveCurrency(row as Record<string, unknown>)) ??
                  undefined
                );
              })()}
            >
              {(() => {
                const v = row[p.key];
                if (p.options && v != null && v !== "") {
                  const optLabel = p.options.find((o) => o.value === String(v))?.label;
                  return translateFieldValue(p.key, optLabel ?? v) || String(v);
                }
                if (p.type === "tel" && v) return formatBrPhone(String(v));
                if (p.type === "cep" && v) return formatCep(String(v));
                if (p.type === "cnpj" && v) return formatCNPJ(String(v));
                const displayType = p.type ?? inferDisplayType(p.key);
                if (
                  (displayType === undefined || displayType === "text") &&
                  v != null &&
                  v !== ""
                ) {
                  const translated = translateFieldValue(p.key, v);
                  if (translated) return translated;
                }
                return formatDisplayValue(displayType, v, row as Record<string, unknown>);
              })()}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setEditing(p.key);
                const raw = String(row[p.key] ?? "");
                setValue(
                  p.type === "cnpj"
                    ? formatCNPJ(raw)
                    : p.type === "currency"
                      ? raw
                      : formatBrPhone(raw) || raw,
                );
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const rowRecord = row as Record<string, unknown>;
  const hasOwner = Object.prototype.hasOwnProperty.call(row, "owner_id");
  const hasAssigned = Object.prototype.hasOwnProperty.call(row, "assigned_to");
  const hasCreator = hasOwner || Object.prototype.hasOwnProperty.call(row, "created_by");
  const responsible = responsibleId(rowRecord as Parameters<typeof responsibleId>[0]);
  const creator = creatorId(rowRecord as Parameters<typeof creatorId>[0]);
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Sobre</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => setShowHist(true)}
        >
          <History className="h-3 w-3 mr-1" /> Histórico
        </Button>
      </div>
      {(hasAssigned || hasOwner) && (
        <div className="pb-4 border-b border-border/60 space-y-4">
          {hasAssigned ? (
            <AssigneeField
              table={table}
              rowId={row.id}
              assignedTo={responsible}
              onChanged={() => onSaved?.()}
            />
          ) : (
            <OwnerField
              table={table}
              rowId={row.id}
              ownerId={rowRecord.owner_id as string | null | undefined}
              onChanged={() => onSaved?.()}
            />
          )}
          {hasAssigned && hasCreator && <CreatorField creatorId={creator} compact />}
        </div>
      )}

      {useSections ? (
        <div className="space-y-5">
          {renderableSections.map((s) => (
            <div key={s.title} className="space-y-3">
              <div className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                {s.title}
              </div>
              <div className="space-y-4">{s.items.map(renderField)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">{display.map(renderField)}</div>
      )}

      {isCustomEntity && customDefs.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          {Object.entries(
            customDefs.reduce<Record<string, CustomProp[]>>((acc, d) => {
              const g = (d as { group_name?: string | null }).group_name || "Personalizadas";
              (acc[g] ||= []).push(d);
              return acc;
            }, {}),
          ).map(([g, list]) => (
            <div key={g} className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{g}</div>
              {list.map((d) => (
                <CustomFieldRow
                  key={d.id}
                  def={d}
                  value={customValues[d.key]}
                  onChange={(v) => saveCustom(d.key, v)}
                  entityId={row.id}
                  onComputed={onSaved}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            Ver todas as propriedades
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Todas as propriedades</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {props.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{p.label}</Label>
                {p.type === "company" ? (
                  <CompanyFieldAll
                    table={table}
                    rowId={row.id}
                    field={p.key}
                    initial={String(row[p.key] ?? "")}
                    onSaved={onSaved}
                    onCreateNew={(name) => openCreateCompany(p.key, name)}
                  />
                ) : p.type === "cnpj" ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    defaultValue={formatCNPJ(String(row[p.key] ?? ""))}
                    onChange={(e) => {
                      e.currentTarget.value = formatCnpjInput(e.currentTarget.value);
                    }}
                    onBlur={async (e) => {
                      const raw = e.target.value;
                      const digits = stripCNPJ(raw);
                      const current = String(row[p.key] ?? "");
                      const toSave = digits || null;
                      if ((toSave ?? "") === current) return;
                      if (digits && !isCNPJ(digits)) {
                        toast.error("CNPJ inválido.");
                        return;
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        .from(table)
                        .update({ [p.key]: toSave })
                        .eq("id", row.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Atualizado");
                        onSaved?.();
                      }
                    }}
                  />
                ) : p.type === "cep" ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="99999-999"
                    defaultValue={formatCep(String(row[p.key] ?? ""))}
                    onChange={(e) => {
                      e.currentTarget.value = formatCep(e.currentTarget.value);
                    }}
                    onBlur={async (e) => {
                      const raw = e.target.value;
                      const digits = raw.replace(/\D/g, "");
                      const current = String(row[p.key] ?? "");
                      const toSave = digits ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
                      if ((toSave ?? "") === current) return;
                      if (digits && digits.length !== 8) {
                        toast.error("CEP inválido. Use 8 dígitos (99999-999).");
                        return;
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        .from(table)
                        .update({ [p.key]: toSave })
                        .eq("id", row.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Atualizado");
                        onSaved?.();
                      }
                    }}
                  />
                ) : p.type === "tel" ? (
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="(11) 99999-8888"
                    defaultValue={
                      formatBrPhone(String(row[p.key] ?? "")) || String(row[p.key] ?? "")
                    }
                    onChange={(e) => {
                      e.currentTarget.value = formatPhoneInput(e.currentTarget.value);
                    }}
                    onBlur={async (e) => {
                      const raw = e.target.value;
                      const current = String(row[p.key] ?? "");
                      let toSave: string | null = raw || null;
                      if (toSave) {
                        const n = toE164(toSave);
                        if (!n) {
                          toast.error("Telefone inválido. Use o formato E.164.");
                          return;
                        }
                        toSave = n;
                      }
                      if ((toSave ?? "") === current) return;
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        .from(table)
                        .update({ [p.key]: toSave })
                        .eq("id", row.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Atualizado");
                        onSaved?.();
                      }
                    }}
                  />
                ) : (
                  <Input
                    type={p.type ?? "text"}
                    defaultValue={String(row[p.key] ?? "")}
                    onBlur={async (e) => {
                      const raw = e.target.value;
                      if (raw === String(row[p.key] ?? "")) return;
                      let toSave: string | null = raw || null;
                      if (p.type === "email" && toSave) {
                        toSave = toSave.trim();
                        if (!isEmail(toSave)) {
                          toast.error("Email inválido.");
                          return;
                        }
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        .from(table)
                        .update({ [p.key]: toSave })
                        .eq("id", row.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Atualizado");
                        onSaved?.();
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {hsProps && (
        <Dialog open={showHs} onOpenChange={setShowHs}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Database className="h-3.5 w-3.5 mr-1" />
              Mais campos (HubSpot) {extraHsEntries.length ? `· ${extraHsEntries.length}` : ""}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Campos do HubSpot</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Somente leitura. Dados originais recebidos do HubSpot na última importação.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {Object.entries(hsProps).map(([k, v]) => (
                <div key={k} className="space-y-0.5 min-w-0">
                  <Label className="text-xs text-muted-foreground break-all">{k}</Label>
                  <div className="text-sm break-words border rounded px-2 py-1 bg-muted/40">
                    {v === null || v === "" || v === undefined ? "—" : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <PropertyHistoryDrawer
        open={showHist}
        onOpenChange={setShowHist}
        entity={entity}
        entityId={row.id}
      />

      <QuickCreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={(v) => {
          setCreateCompanyOpen(v);
          if (!v) setPendingCompanyField(null);
        }}
        initialName={pendingCompanyName}
        onCreated={(id) => {
          void handleCompanyCreated(id);
        }}
      />
    </div>
  );
}

function CompanyFieldAll({
  table,
  rowId,
  field,
  initial,
  onSaved,
  onCreateNew,
}: {
  table: string;
  rowId: string;
  field: string;
  initial: string;
  onSaved?: () => void;
  onCreateNew?: (name: string) => void;
}) {
  const [val, setVal] = useState<CompanyPickerValue>({ id: null, name: initial });
  const save = async () => {
    const toSave = val.name.trim() || null;
    if (toSave === (initial || null)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: affected, error } = await (supabase as any)
      .from(table)
      .update({ [field]: toSave })
      .eq("id", rowId)
      .select("id");
    if (error) toast.error(error.message);
    else if (!deniedIfUnaffected(affected)) {
      toast.success("Atualizado");
      onSaved?.();
    }
  };
  return (
    <div onBlur={save}>
      <CompanyPicker value={val} onChange={setVal} onCreateNew={onCreateNew} />
    </div>
  );
}

function CustomFieldRow({
  def,
  value,
  onChange,
  entityId,
  onComputed,
}: {
  def: CustomProp;
  value: unknown;
  onChange: (v: unknown) => void | Promise<void>;
  entityId: string;
  onComputed?: () => void;
}) {
  const [draft, setDraft] = useState<string>(
    value == null ? "" : Array.isArray(value) ? (value as string[]).join(",") : String(value),
  );
  const [computing, setComputing] = useState(false);
  const computeFn = useServerFn(computeAiProperty);
  useEffect(() => {
    setDraft(
      value == null ? "" : Array.isArray(value) ? (value as string[]).join(",") : String(value),
    );
  }, [value]);

  const commit = (raw: string) => {
    if (raw === "" || raw == null) {
      onChange(null);
      return;
    }
    if (def.type === "number") {
      const n = Number(raw);
      onChange(Number.isFinite(n) ? n : null);
      return;
    }
    onChange(raw);
  };

  const runAi = async () => {
    setComputing(true);
    try {
      await computeFn({ data: { property_id: def.id, entity_id: entityId } });
      toast.success("Calculado pela IA");
      onComputed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setComputing(false);
    }
  };

  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground flex items-center justify-between gap-1">
        <span className="flex items-center gap-1">
          {def.label}
          {def.required && <span className="text-destructive">*</span>}
        </span>
        {def.ai_prompt && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={runAi}
            disabled={computing}
            title="Calcular com IA"
          >
            {computing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
      {def.type === "textarea" ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          rows={3}
          className="mt-0.5"
        />
      ) : def.type === "boolean" ? (
        <div className="mt-1">
          <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
        </div>
      ) : def.type === "select" ? (
        <Select
          value={(value as string | undefined) ?? ""}
          onValueChange={(v) => onChange(v || null)}
        >
          <SelectTrigger className="h-8 mt-0.5">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {((def.options as string[] | undefined) ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : def.type === "multiselect" ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {((def.options as string[] | undefined) ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o);
            return (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                className="h-6 text-xs"
                onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
              >
                {o}
              </Button>
            );
          })}
        </div>
      ) : (
        <Input
          type={
            def.type === "number"
              ? "number"
              : def.type === "date"
                ? "date"
                : def.type === "email"
                  ? "email"
                  : def.type === "url"
                    ? "url"
                    : def.type === "tel"
                      ? "tel"
                      : "text"
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className="h-8 mt-0.5"
        />
      )}
    </div>
  );
}
