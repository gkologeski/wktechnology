// Edição em massa dinâmica: lista os campos da entidade a partir do catálogo
// (mesma fonte do seletor de colunas) e aplica só os campos marcados.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { getEntityFieldCatalog, type EntityFieldDef } from "@/lib/entity-fields.functions";
import { bulkUpdateEntity } from "@/lib/grid/bulk-edit.functions";
import { isBulkEditDeniedColumn, type BulkEditEntity } from "@/lib/grid/bulk-edit-fields";
import { BulkRefPicker } from "./bulk-ref-picker";

const LONG_TEXT_FIELDS = new Set([
  "description",
  "notes",
  "body",
  "summary",
  "comments",
  "requirements",
  "address",
]);

type Props = {
  open: boolean;
  setOpen: (b: boolean) => void;
  /** Entidade/tabela do catálogo de campos. */
  entity: BulkEditEntity;
  ids: string[];
  entityLabel: string;
  /** Campos que aparecem no topo da lista (os já declarados pela tela). */
  priorityFields?: string[];
  onDone: () => void;
};

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: EntityFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const strVal = value == null ? "" : String(value);

  if (field.ref) {
    return <BulkRefPicker kind={field.ref} value={strVal} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <div className="flex h-9 items-center gap-2">
        <Switch
          id={`bulk-${field.name}`}
          checked={value === true}
          onCheckedChange={(c) => onChange(c)}
        />
        <span className="text-sm text-muted-foreground">{value === true ? "Sim" : "Não"}</span>
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <Select value={strVal || undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={`bulk-${field.name}`}>
          <SelectValue placeholder="Selecionar…" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "currency") {
    return (
      <CurrencyInput
        id={`bulk-${field.name}`}
        value={value == null || value === "" ? null : Number(value)}
        onValueChange={(n) => onChange(n)}
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        id={`bulk-${field.name}`}
        inputMode="decimal"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    );
  }

  if (field.type === "date") {
    return (
      <Input
        id={`bulk-${field.name}`}
        type="datetime-local"
        value={/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(strVal) ? strVal.slice(0, 16) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
    );
  }

  if (LONG_TEXT_FIELDS.has(field.name) || field.richText) {
    return (
      <Textarea
        id={`bulk-${field.name}`}
        rows={3}
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={`bulk-${field.name}`}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Novo valor"
    />
  );
}

export function BulkEditFieldsDialog({
  open,
  setOpen,
  entity,
  ids,
  entityLabel,
  priorityFields,
  onDone,
}: Props) {
  const loadCatalog = useServerFn(getEntityFieldCatalog);
  const applyBulk = useServerFn(bulkUpdateEntity);

  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [showSystem, setShowSystem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setEnabled({});
      setValues({});
      setConfirming(false);
      setShowSystem(false);
    }
  }, [open]);

  const catalog = useQuery({
    queryKey: ["bulk-edit-catalog", entity],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: () => loadCatalog({ data: { entity } }),
  });

  const allFields = useMemo(() => {
    const fields = (catalog.data?.fields ?? []).filter((f) => !isBulkEditDeniedColumn(f.name));
    const priority = new Set(priorityFields ?? []);
    return [...fields].sort((a, b) => {
      const pa = priority.has(a.name) ? 0 : 1;
      const pb = priority.has(b.name) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }, [catalog.data, priorityFields]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFields;
    return allFields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
    );
  }, [allFields, query]);

  const visible = filtered.filter((f) => !f.system || enabled[f.name]);
  const systemFields = filtered.filter((f) => f.system && !enabled[f.name]);

  const selectedNames = Object.keys(enabled).filter((k) => enabled[k]);

  const apply = async () => {
    if (selectedNames.length === 0) {
      toast.error("Marque ao menos um campo para alterar");
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const name of selectedNames) {
      const field = allFields.find((f) => f.name === name);
      const raw = values[name];
      const isEmpty = raw === "" || raw === undefined || raw === null;
      if (isEmpty && field?.required) {
        toast.error(`${field.label}: campo obrigatório não pode ficar vazio.`);
        return;
      }
      payload[name] = isEmpty ? null : raw;
    }

    setBusy(true);
    try {
      const res = await applyBulk({ data: { entity, ids, values: payload } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (res.updated === 0) {
        toast.error("Nenhum registro foi alterado. Verifique suas permissões.");
        return;
      }
      if (res.updated < res.requested) {
        toast.warning(
          `${res.updated} de ${res.requested} atualizado(s). Verifique suas permissões.`,
        );
      } else {
        toast.success(`${res.updated.toLocaleString("pt-BR")} registro(s) atualizado(s)`);
      }
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar a edição em massa");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Editar {ids.length.toLocaleString("pt-BR")} {entityLabel}
          </DialogTitle>
          <DialogDescription>
            Marque apenas os campos que deseja sobrescrever em todos os registros selecionados.
            Campos deixados em branco são limpos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar campo…"
            className="h-9 pl-8"
            aria-label="Buscar campo"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {catalog.isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {catalog.isError && (
            <div className="rounded-md border border-destructive/40 p-4 text-sm">
              <p className="font-medium">Não foi possível carregar os campos.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => catalog.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!catalog.isLoading && !catalog.isError && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum campo encontrado para “{query}”.
            </p>
          )}

          {visible.map((f) => (
            <div key={f.name} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`en-${f.name}`}
                  checked={!!enabled[f.name]}
                  onCheckedChange={(v) =>
                    setEnabled((s) => ({ ...s, [f.name]: v === true ? true : false }))
                  }
                />
                <Label htmlFor={`en-${f.name}`} className="cursor-pointer">
                  {f.label}
                  {f.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
              </div>
              {enabled[f.name] && (
                <FieldEditor
                  field={f}
                  value={values[f.name]}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                />
              )}
            </div>
          ))}

          {systemFields.length > 0 && (
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowSystem((s) => !s)}
                aria-expanded={showSystem}
              >
                {showSystem ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Campos de sistema e integração ({systemFields.length})
              </button>
              {showSystem && (
                <div className="space-y-2 border-t p-3">
                  {systemFields.map((f) => (
                    <div key={f.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`en-${f.name}`}
                        checked={!!enabled[f.name]}
                        onCheckedChange={(v) =>
                          setEnabled((s) => ({ ...s, [f.name]: v === true ? true : false }))
                        }
                      />
                      <Label htmlFor={`en-${f.name}`} className="cursor-pointer">
                        {f.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {selectedNames.length === 0
              ? "Nenhum campo marcado."
              : `${selectedNames.length} campo(s) serão alterados em ${ids.length.toLocaleString("pt-BR")} registro(s).`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            {confirming ? (
              <Button onClick={apply} disabled={busy}>
                {busy ? "Aplicando…" : "Confirmar alteração"}
              </Button>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={busy || selectedNames.length === 0}
              >
                Aplicar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
