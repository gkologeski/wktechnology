import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { StickyNote, ListTodo, Phone, Mail, CalendarDays, Trash2 } from "lucide-react";

const ICONS: Record<ActivityType, ReactNode> = {
  note: <StickyNote className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <CalendarDays className="h-4 w-4" />,
};

type RelatedKey = "related_lead_id" | "related_contact_id" | "related_company_id" | "related_deal_id";

export function ActivityTimeline({ relatedKey, relatedId }: { relatedKey: RelatedKey; relatedId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq(relatedKey, relatedId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Activity[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [relatedId]);

  const add = async () => {
    if (!user) return;
    if (!body.trim() && !subject.trim()) {
      toast.error("Adicione um assunto ou texto.");
      return;
    }
    const { error } = await supabase.from("activities").insert({
      owner_id: user.id,
      type,
      subject: subject || null,
      body: body || null,
      due_date: type === "task" && dueDate ? new Date(dueDate).toISOString() : null,
      [relatedKey]: relatedId,
    });
    if (error) return toast.error(error.message);
    setSubject(""); setBody(""); setDueDate("");
    void load();
  };

  const toggleDone = async (a: Activity) => {
    const { error } = await supabase.from("activities").update({ completed: !a.completed }).eq("id", a.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Assunto (opcional)" value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 min-w-[200px]" />
          {type === "task" && (
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-56" />
          )}
        </div>
        <Textarea placeholder="Adicione uma nota ou descrição..." value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
        <div className="flex justify-end">
          <Button onClick={add} size="sm">Adicionar</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</div>
      ) : (
        <ol className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border bg-card p-3 flex gap-3">
              <div className="mt-1 text-muted-foreground">{ICONS[a.type as ActivityType]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {a.type === "task" && (
                    <Checkbox checked={a.completed} onCheckedChange={() => toggleDone(a)} />
                  )}
                  <span className={`font-medium ${a.completed ? "line-through text-muted-foreground" : ""}`}>
                    {a.subject || ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}
                  </span>
                  {a.due_date && (
                    <span className="text-xs text-muted-foreground">• vence {formatDateTime(a.due_date)}</span>
                  )}
                </div>
                {a.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                <div className="text-xs text-muted-foreground mt-1">{formatDateTime(a.created_at)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
