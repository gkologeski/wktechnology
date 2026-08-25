import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { qk } from "@/lib/entity-queries";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type FieldType = "text" | "textarea" | "json" | "number" | "switch";

export type CrudField = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  help?: string;
};

export function CrudSettings<T extends { id: string }>({
  table,
  title,
  description,
  fields,
  columns,
  defaults,
  extraInsert,
  rowActions,
  filter,
}: {
  table: string;
  title: string;
  description?: string;
  fields: CrudField[];
  columns: { key: string; label: string; render?: (r: T) => ReactNode }[];
  defaults?: Record<string, unknown>;
  extraInsert?: Record<string, unknown>;
  /** Ações extras por linha (ex.: editar perguntas). */
  rowActions?: (row: T) => ReactNode;
  /** Filtro de igualdade aplicado na listagem e replicado no insert. */
  filter?: Record<string, string | number | boolean>;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const filterKey = JSON.stringify(filter ?? {});

  const { data: rows = [] } = useQuery<T[]>({
    queryKey: [...qk.crudList(table), filterKey],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from(table).select("*");
      for (const [k, v] of Object.entries(filter ?? {})) q = q.eq(k, v);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data as T[]) ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.crudList(table) });

  const startNew = () => {
    const init: Record<string, unknown> = { ...(defaults ?? {}) };
    fields.forEach((f) => {
      if (init[f.name] === undefined)
        init[f.name] = f.defaultValue ?? (f.type === "switch" ? true : "");
    });
    setForm(init);
    setEditing("new");
  };
  const startEdit = (r: T) => {
    const init: Record<string, unknown> = {};
    fields.forEach((f) => {
      const v = (r as Record<string, unknown>)[f.name];
      init[f.name] =
        f.type === "json" ? JSON.stringify(v ?? f.defaultValue ?? {}, null, 2) : (v ?? "");
    });
    setForm(init);
    setEditing(r);
  };

  const save = async () => {
    const payload: Record<string, unknown> = { ...(extraInsert ?? {}), ...(filter ?? {}) };
    for (const f of fields) {
      let v = form[f.name];
      if (f.type === "json") {
        try {
          v = JSON.parse(String(v || "{}"));
        } catch {
          return toast.error(`JSON inválido em ${f.label}`);
        }
      }
      if (f.type === "number") v = v === "" ? null : Number(v);
      if (f.required && (v === "" || v == null)) return toast.error(`${f.label} obrigatório`);
      payload[f.name] = v;
    }
    let error;
    if (editing === "new") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase as any).from(table).insert(payload));
    } else if (editing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase as any).from(table).update(payload).eq("id", editing.id));
    }
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    void invalidate();
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Excluir?"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    void invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="rounded-lg border bg-card divide-y">
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum item.</p>}
        {rows.map((r) => (
          <div
            key={r.id}
            className="p-3 flex items-center gap-3 hover:bg-accent/30 cursor-pointer"
            onClick={() => startEdit(r)}
          >
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {columns.map((c) => (
                <div key={c.key} className="truncate">
                  <span className="text-xs text-muted-foreground">{c.label}: </span>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </div>
              ))}
            </div>
            {rowActions && (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                role="presentation"
              >
                {rowActions(r)}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir"
              onClick={(e) => {
                e.stopPropagation();
                remove(r.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">{editing === "new" ? "Novo" : "Editar"}</h3>
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label className="text-xs">
                {f.label}
                {f.required && " *"}
              </Label>
              {f.type === "textarea" || f.type === "json" ? (
                <Textarea
                  value={String(form[f.name] ?? "")}
                  placeholder={f.placeholder}
                  rows={f.type === "json" ? 8 : 3}
                  className={f.type === "json" ? "font-mono text-xs" : undefined}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : f.type === "switch" ? (
                <Switch
                  checked={!!form[f.name]}
                  onCheckedChange={(v) => setForm({ ...form, [f.name]: v })}
                />
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={String(form[f.name] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
