import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings/lead-sources")({
  component: LeadSourcesPage,
});

type Row = { id: string; name: string; active: boolean };

function LeadSourcesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("lead_sources")
      .select("id, name, active")
      .order("name", { ascending: true });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("lead_sources")
      .insert({ owner_id: user.id, name: name.trim(), active: true });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Fonte adicionada");
    void load();
  };

  const toggle = async (r: Row) => {
    const { error } = await supabase.from("lead_sources").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const rename = async (id: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    const { error } = await supabase.from("lead_sources").update({ name: v }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async () => {
    if (!confirmId) return;
    const { error } = await supabase.from("lead_sources").delete().eq("id", confirmId);
    setConfirmId(null);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    void load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Fontes de lead" description="Catálogo de origens usadas ao criar leads." />

      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Ex.: Indicação, Site, LinkedIn…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={saving || !name.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="rounded-lg border bg-card divide-y">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <Input
              defaultValue={r.name}
              className="flex-1 h-8"
              onBlur={(e) => e.target.value.trim() !== r.name && rename(r.id, e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.active ? "Ativa" : "Inativa"}</span>
              <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setConfirmId(r.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(v) => !v && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              Leads existentes mantêm o texto original. Esta ação apenas remove a opção do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
