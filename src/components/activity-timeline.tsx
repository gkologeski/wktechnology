import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RichHtmlEditor, HtmlContent } from "@/components/rich-html-editor";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  StickyNote, ListTodo, Phone, Mail, CalendarDays, Trash2, Paperclip, AtSign, X, Download, Pencil, Check,
  MessageSquare, MessageCircle, Linkedin, Send, Inbox, Workflow, MoreHorizontal, Lock,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { CallDialer } from "@/components/voice/call-dialer";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";


const ICONS: Record<ActivityType, ReactNode> = {
  note: <StickyNote className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <CalendarDays className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  postal_mail: <Inbox className="h-4 w-4" />,
  linkedin_message: <Linkedin className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
};

type RelatedKey = "related_lead_id" | "related_contact_id" | "related_company_id" | "related_deal_id";
type Attachment = { path: string; name: string; size: number; type: string };
type TeamMember = { id: string; name: string };

// Ações tipo "Registrar" (composer inline com texto)
type LogKind = ActivityType;
const LOG_LABEL: Record<LogKind, string> = {
  note: "Nota",
  task: "Tarefa",
  email: "Registrar e-mail",
  call: "Registrar chamada",
  meeting: "Registrar reunião",
  whatsapp: "Registrar WhatsApp",
  sms: "Registrar SMS",
  linkedin_message: "Registrar LinkedIn",
  postal_mail: "Registrar correio",
};

type CreateAction = "meeting" | "email" | "call" | "whatsapp" | "sequence" | "linkedin";

type BarAction =
  | { kind: "log"; value: LogKind; label: string; icon: ReactNode }
  | { kind: "create"; value: CreateAction; label: string; icon: ReactNode; disabled?: boolean };

// Botões fixos da barra (ordem visual)
const PINNED_ACTIONS: BarAction[] = [
  { kind: "log", value: "note", label: "Nota", icon: <StickyNote className="h-5 w-5" /> },
  { kind: "create", value: "email", label: "E-mail", icon: <Mail className="h-5 w-5" /> },
  { kind: "create", value: "call", label: "Ligação", icon: <Phone className="h-5 w-5" /> },
  { kind: "log", value: "task", label: "Tarefa", icon: <ListTodo className="h-5 w-5" /> },
  { kind: "create", value: "meeting", label: "Reunião", icon: <CalendarDays className="h-5 w-5" /> },
];

// Itens do menu "Mais"
const MORE_CREATE: BarAction[] = [
  { kind: "create", value: "whatsapp", label: "Enviar WhatsApp", icon: <MessageCircle className="h-4 w-4" /> },
  { kind: "create", value: "sequence", label: "Inscrever em sequência", icon: <Workflow className="h-4 w-4" />, disabled: true },
  { kind: "create", value: "linkedin", label: "Envolva-se no LinkedIn", icon: <Linkedin className="h-4 w-4" />, disabled: true },
];
const MORE_LOG: BarAction[] = [
  { kind: "log", value: "email", label: "Registrar e-mail", icon: <Mail className="h-4 w-4" /> },
  { kind: "log", value: "call", label: "Registrar chamada", icon: <Phone className="h-4 w-4" /> },
  { kind: "log", value: "meeting", label: "Registrar reunião", icon: <CalendarDays className="h-4 w-4" /> },
  { kind: "log", value: "whatsapp", label: "Registrar conversa do WhatsApp", icon: <MessageCircle className="h-4 w-4" /> },
  { kind: "log", value: "sms", label: "Registrar SMS", icon: <MessageSquare className="h-4 w-4" /> },
  { kind: "log", value: "linkedin_message", label: "Registrar mensagem do LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
  { kind: "log", value: "postal_mail", label: "Registrar correio postal", icon: <Inbox className="h-4 w-4" /> },
];


export function ActivityTimeline({ relatedKey, relatedId }: { relatedKey: RelatedKey; relatedId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"log" | "create">("log");
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mentionState, setMentionState] = useState<{ open: boolean; query: string; pos: number } | null>(null);
  const [mentions, setMentions] = useState<TeamMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Action dialogs open state
  const [openAction, setOpenAction] = useState<CreateAction | null>(null);

  // Contact info resolved from parent entity for action dialogs
  const [target, setTarget] = useState<{ email?: string; phone?: string; contactId?: string; name?: string }>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq(relatedKey, relatedId)
      .order("hs_createdate", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Activity[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [relatedId]);

  // Resolve email/phone/contact from parent entity for the "Criar" actions
  useEffect(() => {
    (async () => {
      try {
        if (relatedKey === "related_lead_id") {
          const { data } = await supabase.from("leads").select("email, phone, first_name, last_name").eq("id", relatedId).maybeSingle();
          if (data) setTarget({ email: data.email ?? undefined, phone: data.phone ?? undefined, name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() });
        } else if (relatedKey === "related_contact_id") {
          const { data } = await supabase.from("contacts").select("id, email, phone, mobile_phone, first_name, last_name").eq("id", relatedId).maybeSingle();
          if (data) setTarget({
            email: data.email ?? undefined,
            phone: data.phone ?? data.mobile_phone ?? undefined,
            contactId: data.id,
            name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
          });
        } else if (relatedKey === "related_company_id") {
          const { data } = await supabase.from("companies").select("phone, name").eq("id", relatedId).maybeSingle();
          if (data) setTarget({ phone: data.phone ?? undefined, name: data.name ?? undefined });
        } else if (relatedKey === "related_deal_id") {
          const { data: d } = await supabase.from("deals").select("primary_contact_id, name").eq("id", relatedId).maybeSingle();
          let contactId = d?.primary_contact_id ?? null;
          if (!contactId) {
            const { data: dc } = await supabase.from("deal_contacts").select("contact_id").eq("deal_id", relatedId).limit(1).maybeSingle();
            contactId = dc?.contact_id ?? null;
          }
          if (contactId) {
            const { data: c } = await supabase.from("contacts").select("id, email, phone, mobile_phone, first_name, last_name").eq("id", contactId).maybeSingle();
            if (c) setTarget({
              email: c.email ?? undefined,
              phone: c.phone ?? c.mobile_phone ?? undefined,
              contactId: c.id,
              name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
            });
          } else {
            setTarget({ name: d?.name ?? undefined });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [relatedKey, relatedId]);

  // Load team members for @mentions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const list: TeamMember[] = [{ id: user.id, name: user.email ?? "Você" }];
      const { data: tm } = await supabase.from("team_members").select("member_user_id");
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
      const { error } = await supabase.storage.from("notes-attachments").upload(path, file, { contentType: file.type });
      if (error) { toast.error(`Falha em ${file.name}: ${error.message}`); continue; }
      out.push({ path, name: file.name, size: file.size, type: file.type });
    }
    return out;
  };

  const resolveAutoLinks = async (): Promise<Partial<Record<RelatedKey, string>>> => {
    const links: Partial<Record<RelatedKey, string>> = { [relatedKey]: relatedId };
    try {
      if (relatedKey === "related_deal_id") {
        const { data: d } = await supabase.from("deals").select("company_id, primary_contact_id").eq("id", relatedId).maybeSingle();
        if (d?.company_id) links.related_company_id = d.company_id;
        let contactId = d?.primary_contact_id ?? null;
        if (!contactId) {
          const { data: dc } = await supabase.from("deal_contacts").select("contact_id").eq("deal_id", relatedId).limit(1).maybeSingle();
          contactId = dc?.contact_id ?? null;
        }
        if (contactId) links.related_contact_id = contactId;
      } else if (relatedKey === "related_contact_id") {
        const { data: c } = await supabase.from("contacts").select("company_id").eq("id", relatedId).maybeSingle();
        if (c?.company_id) links.related_company_id = c.company_id;
      }
    } catch { /* default link already set */ }
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
    const { error } = await supabase.from("activities").insert(payload as never);
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

  const startEdit = (a: Activity) => { setEditingId(a.id); setEditingBody(a.body ?? ""); };

  const saveEdit = async (a: Activity) => {
    const { error } = await supabase.from("activities").update({ body: editingBody || null }).eq("id", a.id);
    if (error) return toast.error(error.message);
    setEditingId(null);
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

  const handleCreateClick = (action: CreateAction) => {
    if (action === "task") {
      // Reuse the log composer in "task" mode (supports due_date)
      setMode("log");
      setType("task");
      return;
    }
    setOpenAction(action);
  };

  const currentLogLabel = LOG_TABS.find((t) => t.value === type)?.label ?? "Atividade";

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          if (files.length) setPendingFiles((p) => [...p, ...files]);
        }}
      >
        {/* Mode switch */}
        <div className="flex items-center gap-1 px-4 pt-3">
          <button
            type="button"
            onClick={() => setMode("log")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              mode === "log" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Registrar
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              mode === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Criar
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground hidden sm:inline">
            {mode === "log" ? "Registre algo que já aconteceu" : "Inicie uma nova ação"}
          </span>
        </div>

        {mode === "log" ? (
          <>
            <nav className="flex border-b border-border/60 overflow-x-auto mt-2">
              {LOG_TABS.map((t) => {
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "text-primary border-b-2 border-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                    }`}
                  >
                    <span className={active ? "text-primary" : "text-muted-foreground"}>{ICONS[t.value]}</span>
                    {t.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Assunto (opcional)" value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 min-w-[200px]" />
                {type === "task" && (
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-56" />
                )}
              </div>
              <div className="relative">
                <RichHtmlEditor
                  value={body}
                  onChange={setBody}
                  placeholder={
                    type === "task"
                      ? "Descreva a tarefa..."
                      : "Descreva o que aconteceu... use @ para mencionar, arraste arquivos para anexar"
                  }
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
              <div className="flex justify-between items-center pt-3 border-t border-border/60">
                <label className="cursor-pointer text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
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
                  <Paperclip className="h-4 w-4" /> Anexar
                </label>
                <Button onClick={add} size="sm" className="rounded-xl shadow-md shadow-primary/20 font-semibold">
                  Salvar {currentLogLabel}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {CREATE_TABS.map((t) => (
              <button
                key={t.value}
                disabled={t.disabled}
                onClick={() => handleCreateClick(t.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                  t.disabled
                    ? "border-border/40 text-muted-foreground/50 cursor-not-allowed bg-muted/20"
                    : "border-border/60 hover:bg-muted hover:border-primary/40"
                }`}
                title={t.disabled ? "Em breve" : undefined}
              >
                <span className={t.disabled ? "" : "text-primary"}>{t.icon}</span>
                <span className="text-xs font-medium">{t.label}</span>
                {t.disabled && <span className="text-[10px] uppercase tracking-wider">em breve</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action dialogs */}
      <MeetingDialog
        open={openAction === "meeting"}
        onOpenChange={(v) => !v && setOpenAction(null)}
        defaultAttendee={target.email ?? ""}
        relatedKey={relatedKey}
        relatedId={relatedId}
        onCreated={() => void load()}
      />
      {openAction === "email" && (
        <SendEmailDialog
          defaultTo={target.email ?? ""}
          contactId={target.contactId}
          contactName={target.name}
          trigger={
            <button
              ref={(el) => { if (el) setTimeout(() => el.click(), 0); }}
              className="hidden"
              aria-hidden
            />
          }
        />
      )}
      {openAction === "call" && target.phone && (
        <CallDialer
          defaultTo={target.phone}
          contactId={target.contactId}
          contactName={target.name}
          trigger={
            <button
              ref={(el) => { if (el) setTimeout(() => el.click(), 0); }}
              className="hidden"
              aria-hidden
            />
          }
        />
      )}
      {openAction === "call" && !target.phone && (() => {
        toast.error("Sem telefone disponível para esta entidade.");
        setTimeout(() => setOpenAction(null), 0);
        return null;
      })()}
      {openAction === "whatsapp" && target.phone && (
        <SendWhatsAppDialog
          defaultTo={target.phone}
          contactId={target.contactId}
          contactName={target.name}
          trigger={
            <button
              ref={(el) => { if (el) setTimeout(() => el.click(), 0); }}
              className="hidden"
              aria-hidden
            />
          }
        />
      )}
      {openAction === "whatsapp" && !target.phone && (() => {
        toast.error("Sem telefone disponível para esta entidade.");
        setTimeout(() => setOpenAction(null), 0);
        return null;
      })()}

      {/* Timeline rail */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Timeline</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</div>
      ) : (
        <ol className="space-y-5">
          {items.map((a) => {
            const atts = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
            const mens = (a as unknown as { mentions?: string[] }).mentions ?? [];
            const icon = ICONS[a.type as ActivityType] ?? <Send className="h-4 w-4" />;
            return (
              <li key={a.id} className="relative pl-10">
                <div className="absolute left-[11px] top-8 bottom-[-1.25rem] w-[2px] bg-border/60 last:hidden" />
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center text-primary z-10">
                  {icon}
                </div>
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
                  <div className="flex justify-between items-start gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.type === "task" && (
                        <Checkbox checked={a.completed} onCheckedChange={() => toggleDone(a)} />
                      )}
                      <h4 className={`text-sm font-semibold text-foreground truncate ${a.completed ? "line-through text-muted-foreground" : ""}`}>
                        {a.subject || ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}
                      </h4>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.hs_createdate ?? a.created_at)}</span>
                  </div>
                  {a.due_date && (
                    <p className="text-xs text-muted-foreground mb-1">Vence {formatDateTime(a.due_date)}</p>
                  )}
                  {a.body && (
                    editingId === a.id ? (
                      <div className="mt-2 space-y-2">
                        <RichHtmlEditor value={editingBody} onChange={setEditingBody} minHeight={120} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(a)}><Check className="h-3 w-3 mr-1" /> Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <HtmlContent html={a.body} className="text-sm text-foreground/90 mt-1" />
                    )
                  )}
                  {mens.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
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
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {atts.map((att, i) => (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(att)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          <Download className="h-3 w-3" /> {att.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 mt-3 pt-3 border-t border-border/60">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => (editingId === a.id ? setEditingId(null) : startEdit(a))}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(a.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
