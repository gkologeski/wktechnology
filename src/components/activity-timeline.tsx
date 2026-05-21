import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { StickyNote, ListTodo, Phone, Mail, CalendarDays, Trash2, Paperclip, AtSign, X, Download, Pencil, Check } from "lucide-react";

const ICONS: Record<ActivityType, ReactNode> = {
  note: <StickyNote className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <CalendarDays className="h-4 w-4" />,
};

type RelatedKey = "related_lead_id" | "related_contact_id" | "related_company_id" | "related_deal_id";

type Attachment = { path: string; name: string; size: number; type: string };

type TeamMember = { id: string; name: string };

export function ActivityTimeline({ relatedKey, relatedId }: { relatedKey: RelatedKey; relatedId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mentionState, setMentionState] = useState<{ open: boolean; query: string; pos: number } | null>(null);
  const [mentions, setMentions] = useState<TeamMember[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Load team members (workspace) for @mentions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const list: TeamMember[] = [{ id: user.id, name: user.email ?? "Você" }];
      const { data: tm } = await supabase
        .from("team_members")
        .select("member_user_id");
      if (tm?.length) {
        const ids = [...new Set(tm.map((t) => t.member_user_id))];
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        for (const p of profs ?? []) {
          if (!list.find((x) => x.id === p.id)) list.push({ id: p.id, name: p.full_name ?? p.id });
        }
      }
      setTeam(list);
    })();
  }, [user]);

  const onBodyChange = (val: string) => {
    setBody(val);
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? val.length;
    const upto = val.slice(0, pos);
    const m = upto.match(/@([\w-]*)$/);
    if (m) {
      setMentionState({ open: true, query: m[1], pos: pos - m[0].length });
    } else {
      setMentionState(null);
    }
  };

  const insertMention = (member: TeamMember) => {
    if (!mentionState) return;
    const before = body.slice(0, mentionState.pos);
    const after = body.slice((textareaRef.current?.selectionStart) ?? body.length);
    setBody(`${before}@${member.name} ${after}`);
    setMentionState(null);
    if (!mentions.find((x) => x.id === member.id)) {
      setMentions((prev) => [...prev, member]);
    }
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (!user || pendingFiles.length === 0) return [];
    const out: Attachment[] = [];
    for (const file of pendingFiles) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("notes-attachments").upload(path, file, {
        contentType: file.type,
      });
      if (error) {
        toast.error(`Falha em ${file.name}: ${error.message}`);
        continue;
      }
      out.push({ path, name: file.name, size: file.size, type: file.type });
    }
    return out;
  };

  const resolveAutoLinks = async (): Promise<Partial<Record<RelatedKey, string>>> => {
    const links: Partial<Record<RelatedKey, string>> = { [relatedKey]: relatedId };
    try {
      if (relatedKey === "related_deal_id") {
        const { data: d } = await supabase
          .from("deals")
          .select("company_id, primary_contact_id")
          .eq("id", relatedId)
          .maybeSingle();
        if (d?.company_id) links.related_company_id = d.company_id;
        let contactId = d?.primary_contact_id ?? null;
        if (!contactId) {
          const { data: dc } = await supabase
            .from("deal_contacts")
            .select("contact_id")
            .eq("deal_id", relatedId)
            .limit(1)
            .maybeSingle();
          contactId = dc?.contact_id ?? null;
        }
        if (contactId) links.related_contact_id = contactId;
      } else if (relatedKey === "related_contact_id") {
        const { data: c } = await supabase
          .from("contacts")
          .select("company_id")
          .eq("id", relatedId)
          .maybeSingle();
        if (c?.company_id) links.related_company_id = c.company_id;
      }
    } catch {
      // silencioso: vínculo padrão (relatedKey) já está garantido
    }
    return links;
  };

  const add = async () => {
    if (!user) return;
    if (!body.trim() && !subject.trim() && pendingFiles.length === 0) {
      toast.error("Adicione um assunto, texto ou anexo.");
      return;
    }
    const attachments = await uploadFiles();
    const autoLinks = await resolveAutoLinks();
    const payload: Record<string, unknown> = {
      owner_id: user.id,
      type,
      subject: subject || null,
      body: body || null,
      due_date: type === "task" && dueDate ? new Date(dueDate).toISOString() : null,
      mentions: mentions.map((m) => m.id),
      attachments,
      ...autoLinks,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("activities").insert(payload as any);
    if (error) return toast.error(error.message);
    setSubject(""); setBody(""); setDueDate(""); setPendingFiles([]); setMentions([]);
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

  const downloadAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("notes-attachments").createSignedUrl(att.path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const filteredMentions = mentionState
    ? team.filter((m) => m.name.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          if (files.length) setPendingFiles((p) => [...p, ...files]);
        }}
      >
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
        <div className="relative">
          <RichHtmlEditor
            value={body}
            onChange={setBody}
            placeholder="Adicione uma nota... use @ para mencionar, arraste arquivos para anexar"
            minHeight={96}
          />
          {mentionState?.open && filteredMentions.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
              {filteredMentions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => insertMention(m)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <AtSign className="h-3 w-3 text-muted-foreground" />
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                <Paperclip className="h-3 w-3" /> {f.name}
                <button onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center">
          <label className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setPendingFiles((p) => [...p, ...files]);
                e.target.value = "";
              }}
            />
            <Paperclip className="inline h-4 w-4 mr-1" /> Anexar
          </label>
          <Button onClick={add} size="sm">Adicionar</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</div>
      ) : (
        <ol className="space-y-2">
          {items.map((a) => {
            const atts = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
            const mens = (a as unknown as { mentions?: string[] }).mentions ?? [];
            return (
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
                  {mens.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {mens.map((id) => {
                        const tm = team.find((t) => t.id === id);
                        return (
                          <Badge key={id} variant="outline" className="text-xs">
                            <AtSign className="h-3 w-3 mr-0.5" />
                            {tm?.name ?? id.slice(0, 8)}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {atts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {atts.map((att, i) => (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(att)}
                          className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          <Download className="h-3 w-3" /> {att.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{formatDateTime(a.created_at)}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
