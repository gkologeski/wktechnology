import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEAL_STAGES, formatCurrency, formatDate, type DealStage } from "@/lib/crm";
import type { Deal, Company, Contact } from "@/lib/db-types";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/deals")({
  component: DealsPage,
});

function DealsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const { data: deals = [] } = useQuery({
    queryKey: ["deals", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data as Pick<Company, "id" | "name">[] ?? [],
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () => (await supabase.from("contacts").select("id,first_name,last_name").order("first_name")).data as Pick<Contact, "id" | "first_name" | "last_name">[] ?? [],
  });

  const grouped = useMemo(() => {
    const map: Record<DealStage, Deal[]> = { new: [], qualified: [], proposal: [], negotiation: [], won: [], lost: [] };
    for (const d of deals) map[d.stage as DealStage]?.push(d);
    return map;
  }, [deals]);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const newStage = e.over?.id as DealStage | undefined;
    if (!newStage) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === newStage) return;
    qc.setQueryData<Deal[]>(["deals", "list"], (old = []) => old.map((d) => (d.id === id ? { ...d, stage: newStage } : d)));
    const { error } = await supabase.from("deals").update({ stage: newStage }).eq("id", id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["deals"] }); }
  };

  return (
    <div>
      <PageHeader
        title="Negócios"
        description="Pipeline de vendas. Arraste cards entre estágios."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />

      <DndContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {DEAL_STAGES.map((s) => (
            <Column key={s.value} stage={s.value} label={s.label} deals={grouped[s.value]} onClick={(d) => { setEditing(d); setOpen(true); }} />
          ))}
        </div>
      </DndContext>

      <DealDialog
        key={editing?.id ?? "new"}
        open={open} setOpen={setOpen} editing={editing}
        companies={companies} contacts={contacts}
        onSaved={() => qc.invalidateQueries({ queryKey: ["deals"] })}
        userId={user?.id}
      />
    </div>
  );
}

function Column({ stage, label, deals, onClick }: { stage: DealStage; label: string; deals: Deal[]; onClick: (d: Deal) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  return (
    <div ref={setNodeRef} className={`rounded-lg border bg-card flex flex-col min-h-[300px] ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label}</h3>
          <span className="text-xs text-muted-foreground">{deals.length}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(total)}</p>
      </div>
      <div className="p-2 space-y-2 flex-1">
        {deals.map((d) => <DealCard key={d.id} deal={d} onClick={() => onClick(d)} />)}
      </div>
    </div>
  );
}

function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 } : undefined;
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners} style={style}
      onClick={onClick}
      className="rounded-md border bg-background p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-primary/40"
    >
      <div className="font-medium truncate">{deal.name}</div>
      <div className="text-xs text-muted-foreground mt-1">{formatCurrency(Number(deal.value), deal.currency)}</div>
      {deal.expected_close_date && <div className="text-xs text-muted-foreground">{formatDate(deal.expected_close_date)}</div>}
    </div>
  );
}

function DealDialog({
  open, setOpen, editing, companies, contacts, onSaved, userId,
}: {
  open: boolean; setOpen: (b: boolean) => void; editing: Deal | null;
  companies: Pick<Company, "id" | "name">[]; contacts: Pick<Contact, "id" | "first_name" | "last_name">[];
  onSaved: () => void; userId?: string;
}) {
  const [v, setV] = useState<Record<string, unknown>>(editing ?? { stage: "new", value: 0, currency: "BRL" });
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    if (!userId) return;
    const payload = {
      owner_id: userId,
      name: String(v.name ?? ""),
      value: Number(v.value || 0),
      currency: String(v.currency || "BRL"),
      stage: (v.stage as DealStage) ?? "new",
      company_id: (v.company_id as string) || null,
      primary_contact_id: (v.primary_contact_id as string) || null,
      expected_close_date: (v.expected_close_date as string) || null,
      notes: (v.notes as string) || null,
    };
    if (!payload.name) return toast.error("Nome obrigatório");
    const { error } = editing
      ? await supabase.from("deals").update(payload).eq("id", editing.id)
      : await supabase.from("deals").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar negócio" : "Novo negócio"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nome *"><Input value={String(v.name ?? "")} onChange={(e) => set("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Valor"><Input type="number" step="0.01" value={String(v.value ?? "")} onChange={(e) => set("value", e.target.value)} /></Field>
            <Field label="Moeda"><Input value={String(v.currency ?? "BRL")} onChange={(e) => set("currency", e.target.value)} /></Field>
          </div>
          <Field label="Estágio">
            <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={String(v.stage ?? "new")} onChange={(e) => set("stage", e.target.value)}>
              {DEAL_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Empresa">
            <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={String(v.company_id ?? "")} onChange={(e) => set("company_id", e.target.value || null)}>
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Contato principal">
            <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={String(v.primary_contact_id ?? "")} onChange={(e) => set("primary_contact_id", e.target.value || null)}>
              <option value="">—</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ""}</option>)}
            </select>
          </Field>
          <Field label="Data prevista">
            <Input type="date" value={String(v.expected_close_date ?? "").slice(0, 10)} onChange={(e) => set("expected_close_date", e.target.value)} />
          </Field>
          <Field label="Notas"><Textarea rows={3} value={String(v.notes ?? "")} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
