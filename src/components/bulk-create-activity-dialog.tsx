import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/crm";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

type Entity = "leads" | "contacts" | "deals" | "companies";

const RELATED_COL: Record<Entity, string> = {
  leads: "related_lead_id",
  contacts: "related_contact_id",
  deals: "related_deal_id",
  companies: "related_company_id",
};

export function BulkCreateActivityDialog({
  open,
  setOpen,
  ids,
  entity,
  onDone,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  ids: string[];
  entity: Entity;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const { data: members } = useWorkspaceMembers();
  const [type, setType] = useState<ActivityType>("task");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim()) return toast.error("Assunto é obrigatório");
    setSaving(true);
    const col = RELATED_COL[entity];
    // `owner_id` precisa ser o próprio usuário (RLS: owner_id = auth.uid()).
    // O responsável escolhido vai em `assigned_to`.
    const rows = ids.map((id) => ({
      owner_id: user.id,
      created_by: user.id,
      assigned_to: assigneeId || user.id,
      type,
      subject,
      body: body || null,
      due_date: due ? new Date(due).toISOString() : null,
      [col]: id,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("activities").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} atividade(s) criada(s)`);
    setSubject("");
    setBody("");
    setDue("");
    setAssigneeId("");
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar atividade em massa ({ids.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Atribuir para</Label>
            <select
              value={assigneeId || user?.id || ""}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {(members ?? []).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.user_id.slice(0, 8)}
                  {m.user_id === user?.id ? " (você)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <RichHtmlEditor value={body} onChange={setBody} minHeight={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Data limite</Label>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
