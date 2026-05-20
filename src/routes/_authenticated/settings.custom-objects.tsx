import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listCustomObjects, upsertCustomObject, deleteCustomObject,
  listCustomRecords, upsertCustomRecord, deleteCustomRecord,
  type CustomObjectField,
} from "@/lib/custom-objects.functions";
import { Plus, Trash2, Database, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/custom-objects")({
  component: CustomObjectsPage,
});

type Obj = { id: string; name: string; slug: string; icon: string | null; schema: CustomObjectField[]; created_at: string };
type Rec = { id: string; data: Record<string, unknown>; created_at: string; updated_at: string };

const FIELD_TYPES = ["text","number","date","boolean","select","url","email"] as const;

function CustomObjectsPage() {
  const listObj = useServerFn(listCustomObjects);
  const saveObj = useServerFn(upsertCustomObject);
  const delObj = useServerFn(deleteCustomObject);
  const listRec = useServerFn(listCustomRecords);
  const saveRec = useServerFn(upsertCustomRecord);
  const delRec = useServerFn(deleteCustomRecord);

  const [objs, setObjs] = useState<Obj[]>([]);
  const [openObj, setOpenObj] = useState(false);
  const [edit, setEdit] = useState<Obj | null>(null);
  const [form, setForm] = useState<{ name: string; slug: string; schema: CustomObjectField[] }>({ name: "", slug: "", schema: [] });
  const [active, setActive] = useState<Obj | null>(null);
  const [records, setRecords] = useState<Rec[]>([]);
  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState<Record<string, unknown>>({});
  const [recEdit, setRecEdit] = useState<Rec | null>(null);

  const load = async () => { const r = await listObj({}); setObjs(r.objects as Obj[]); };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: "", slug: "", schema: [] }); setOpenObj(true); };
  const openEdit = (o: Obj) => { setEdit(o); setForm({ name: o.name, slug: o.slug, schema: o.schema ?? [] }); setOpenObj(true); };

  const addField = () => setForm((f) => ({ ...f, schema: [...f.schema, { key: "", label: "", type: "text" }] }));
  const updField = (i: number, patch: Partial<CustomObjectField>) =>
    setForm((f) => ({ ...f, schema: f.schema.map((x, idx) => idx === i ? { ...x, ...patch } : x) }));
  const rmField = (i: number) => setForm((f) => ({ ...f, schema: f.schema.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    try {
      await saveObj({ data: { id: edit?.id, ...form } });
      setOpenObj(false);
      await load();
      toast.success("Objeto salvo");
    } catch (e) { toast.error((e as Error).message); }
  };

  const openRecords = async (o: Obj) => {
    setActive(o);
    const r = await listRec({ data: { object_id: o.id } });
    setRecords(r.records as Rec[]);
  };

  const saveRecord = async () => {
    if (!active) return;
    try {
      await saveRec({ data: { id: recEdit?.id, object_id: active.id, data: recForm } });
      setRecOpen(false);
      const r = await listRec({ data: { object_id: active.id } });
      setRecords(r.records as Rec[]);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Objetos custom</h1>
          <p className="text-sm text-muted-foreground">Crie entidades próprias com schema dinâmico.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo objeto</Button>
      </div>

      <div className="grid gap-3">
        {objs.map((o) => (
          <Card key={o.id}>
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <div className="font-medium flex items-center gap-2"><Database className="h-4 w-4" />{o.name}</div>
                <div className="text-xs text-muted-foreground">/{o.slug} · {(o.schema ?? []).length} campos</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openRecords(o)}><Eye className="h-4 w-4 mr-1" /> Registros</Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={async () => { await delObj({ data: { id: o.id } }); load(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {objs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum objeto custom.</p>}
      </div>

      <Dialog open={openObj} onOpenChange={setOpenObj}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Editar objeto" : "Novo objeto"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})} placeholder="ex: properties" /></div>
            </div>
            <div>
              <div className="flex justify-between items-center"><Label>Campos</Label>
                <Button variant="outline" size="sm" onClick={addField}><Plus className="h-3 w-3 mr-1" /> Campo</Button>
              </div>
              <div className="space-y-2 mt-2">
                {form.schema.map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <Input className="col-span-3" placeholder="key" value={f.key} onChange={(e) => updField(i, { key: e.target.value })} />
                    <Input className="col-span-4" placeholder="label" value={f.label} onChange={(e) => updField(i, { label: e.target.value })} />
                    <Select value={f.type} onValueChange={(v) => updField(i, { type: v as CustomObjectField["type"] })}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="col-span-1" placeholder="opt" value={(f.options ?? []).join(",")} onChange={(e) => updField(i, { options: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })} />
                    <Button variant="ghost" size="sm" className="col-span-1" onClick={() => rmField(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={submit} disabled={!form.name || !form.slug}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader><SheetTitle>{active?.name} — registros</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            <Button size="sm" onClick={() => { setRecEdit(null); setRecForm({}); setRecOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="border rounded-md p-3 text-sm flex justify-between items-start gap-2">
                  <div className="space-y-1 flex-1">
                    {(active?.schema ?? []).map((f) => (
                      <div key={f.key} className="text-xs"><span className="text-muted-foreground">{f.label}: </span>{String(r.data[f.key] ?? "—")}</div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setRecEdit(r); setRecForm(r.data); setRecOpen(true); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={async () => { await delRec({ data: { id: r.id } }); if (active) { const x = await listRec({ data: { object_id: active.id } }); setRecords(x.records as Rec[]); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {records.length === 0 && <p className="text-xs text-muted-foreground">Sem registros.</p>}
            </div>
          </div>

          <Dialog open={recOpen} onOpenChange={setRecOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>{recEdit ? "Editar registro" : "Novo registro"}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                {(active?.schema ?? []).map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    {f.type === "select" ? (
                      <Select value={String(recForm[f.key] ?? "")} onValueChange={(v) => setRecForm({...recForm, [f.key]: v})}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
                        value={String(recForm[f.key] ?? "")}
                        onChange={(e) => setRecForm({...recForm, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value})}
                      />
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter><Button onClick={saveRecord}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>
    </div>
  );
}
