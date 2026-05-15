import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Papa from "papaparse";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type EntityListProps<T extends { id: string }> = {
  table: "companies" | "contacts" | "leads" | "deals";
  title: string;
  description?: string;
  columns: { key: keyof T | string; label: string; render?: (row: T) => ReactNode }[];
  fields: Field[];
  defaults?: Partial<T>;
  detailPath?: (id: string) => string;
  searchKeys?: (keyof T)[];
  csvEnabled?: boolean;
  toolbar?: ReactNode;
  rowActions?: (row: T) => ReactNode;
};

export function EntityList<T extends { id: string; owner_id?: string }>({
  table, title, description, columns, fields, defaults, detailPath, searchKeys, csvEnabled, toolbar, rowActions,
}: EntityListProps<T>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table, "list"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from(table).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (searchKeys ?? []).some((k) => String((r as Record<string, unknown>)[k as string] ?? "").toLowerCase().includes(q));
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setOpen(true); };

  const remove = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: [table] });
  };

  const exportCsv = () => {
    const csv = Papa.unparse(filtered as unknown as Record<string, unknown>[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${table}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    if (!user) return;
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const fieldNames = new Set(fields.map((f) => f.name));
        const rowsToInsert = res.data.map((r) => {
          const obj: Record<string, unknown> = { owner_id: user.id };
          for (const k of Object.keys(r)) if (fieldNames.has(k)) obj[k] = r[k] === "" ? null : r[k];
          return obj;
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).insert(rowsToInsert);
        if (error) toast.error(error.message);
        else { toast.success(`${rowsToInsert.length} registros importados`); qc.invalidateQueries({ queryKey: [table] }); }
      },
    });
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {csvEnabled && (
              <>
                <Button variant="outline" size="sm" onClick={exportCsv}>Exportar CSV</Button>
                <label className="inline-flex">
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
                  <span className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-9 text-sm cursor-pointer hover:bg-muted">Importar CSV</span>
                </label>
              </>
            )}
            {toolbar}
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          </>
        }
      />

      <div className="mb-4">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => <TableHead key={String(c.key)}>{c.label}</TableHead>)}
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">Nenhum registro.</TableCell></TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className={detailPath ? "cursor-pointer" : ""} onClick={() => detailPath && (window.location.href = detailPath(row.id))}>
                  {columns.map((c) => (
                    <TableCell key={String(c.key)}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? "—")}
                    </TableCell>
                  ))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions?.(row)}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EntityDialog
        key={editing?.id ?? "new"}
        open={open} setOpen={setOpen} table={table} fields={fields} editing={editing} defaults={defaults}
        onSaved={() => qc.invalidateQueries({ queryKey: [table] })}
      />
    </div>
  );
}

function EntityDialog<T extends { id: string }>({
  open, setOpen, table, fields, editing, defaults, onSaved,
}: {
  open: boolean; setOpen: (b: boolean) => void; table: string; fields: Field[];
  editing: T | null; defaults?: Partial<T>; onSaved: () => void;
}) {
  const { user } = useAuth();
  const init: Record<string, unknown> = editing
    ? { ...editing }
    : { ...(defaults ?? {}) };
  const [values, setValues] = useState<Record<string, unknown>>(init);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!user) return;
    const payload: Record<string, unknown> = { ...values };
    for (const f of fields) {
      if (payload[f.name] === "" || payload[f.name] === undefined) payload[f.name] = null;
      if (f.type === "number" && payload[f.name] != null) payload[f.name] = Number(payload[f.name]);
    }
    payload.owner_id = user.id;
    let error;
    if (editing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase as any).from(table).update(payload).eq("id", editing.id));
    } else {
      delete payload.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase as any).from(table).insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><span /></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Novo registro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              {f.type === "textarea" ? (
                <Textarea id={f.name} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} rows={3} />
              ) : f.type === "select" ? (
                <select id={f.name} className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value || null)}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <Input id={f.name} type={f.type ?? "text"} required={f.required}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
