import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RichHtmlEditor, HtmlContent, extractMentionIds } from "@/components/rich-html-editor";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  StickyNote, ListTodo, Phone, Mail, CalendarDays, Trash2, Paperclip, AtSign, X, Download, Pencil, Check,
  MessageSquare, MessageCircle, Linkedin, Send, Inbox, Workflow, MoreHorizontal, Lock, Sparkles,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { CallDialer } from "@/components/voice/call-dialer";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";


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

const actionKey = (a: BarAction) => `${a.kind}:${a.value}`;

// Catálogo de todas as ações disponíveis
const ALL_ACTIONS: BarAction[] = [
  { kind: "log", value: "note", label: "Nota", icon: <StickyNote className="h-5 w-5" /> },
  { kind: "create", value: "email", label: "E-mail", icon: <Mail className="h-5 w-5" /> },
  { kind: "create", value: "call", label: "Ligação", icon: <Phone className="h-5 w-5" /> },
  { kind: "log", value: "task", label: "Tarefa", icon: <ListTodo className="h-5 w-5" /> },
  { kind: "create", value: "meeting", label: "Reunião", icon: <CalendarDays className="h-5 w-5" /> },
  { kind: "create", value: "whatsapp", label: "Enviar WhatsApp", icon: <MessageCircle className="h-5 w-5" /> },
  { kind: "create", value: "sequence", label: "Inscrever em sequência", icon: <Workflow className="h-5 w-5" />, disabled: true },
  { kind: "create", value: "linkedin", label: "Envolva-se no LinkedIn", icon: <Linkedin className="h-5 w-5" />, disabled: true },
  { kind: "log", value: "email", label: "Registrar e-mail", icon: <Mail className="h-5 w-5" /> },
  { kind: "log", value: "call", label: "Registrar chamada", icon: <Phone className="h-5 w-5" /> },
  { kind: "log", value: "meeting", label: "Registrar reunião", icon: <CalendarDays className="h-5 w-5" /> },
  { kind: "log", value: "whatsapp", label: "Registrar conversa do WhatsApp", icon: <MessageCircle className="h-5 w-5" /> },
  { kind: "log", value: "sms", label: "Registrar SMS", icon: <MessageSquare className="h-5 w-5" /> },
  { kind: "log", value: "linkedin_message", label: "Registrar mensagem do LinkedIn", icon: <Linkedin className="h-5 w-5" /> },
  { kind: "log", value: "postal_mail", label: "Registrar correio postal", icon: <Inbox className="h-5 w-5" /> },
];
const ACTIONS_BY_KEY: Record<string, BarAction> = Object.fromEntries(ALL_ACTIONS.map((a) => [actionKey(a), a]));

const DEFAULT_PINNED = ALL_ACTIONS.slice(0, 5).map(actionKey);
const DEFAULT_MORE = ALL_ACTIONS.slice(5).map(actionKey);

const STORAGE_KEY = "activity-action-order-v1";

type OrderState = { pinned: string[]; more: string[] };

function loadOrder(): OrderState {
  if (typeof window === "undefined") return { pinned: DEFAULT_PINNED, more: DEFAULT_MORE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pinned: DEFAULT_PINNED, more: DEFAULT_MORE };
    const parsed = JSON.parse(raw) as Partial<OrderState>;
    const seen = new Set<string>([...(parsed.pinned ?? []), ...(parsed.more ?? [])]);
    const missing = ALL_ACTIONS.map(actionKey).filter((k) => !seen.has(k));
    return {
      pinned: (parsed.pinned ?? DEFAULT_PINNED).filter((k) => k in ACTIONS_BY_KEY),
      more: [...(parsed.more ?? DEFAULT_MORE).filter((k) => k in ACTIONS_BY_KEY), ...missing],
    };
  } catch {
    return { pinned: DEFAULT_PINNED, more: DEFAULT_MORE };
  }
}


export function ActivityTimeline({ relatedKey, relatedId }: { relatedKey: RelatedKey; relatedId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState<LogKind>("note");
  const [moreOpen, setMoreOpen] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mentions, setMentions] = useState<TeamMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  // Action dialogs open state
  const [openAction, setOpenAction] = useState<CreateAction | null>(null);

  // Contact info resolved from parent entity for action dialogs
  const [target, setTarget] = useState<{ email?: string; phone?: string; contactId?: string; name?: string }>({});

  // Ordem reorganizável das ações (persistida em localStorage)
  const [order, setOrder] = useState<OrderState>(() => loadOrder());
  const [dragKey, setDragKey] = useState<string | null>(null);

  const persistOrder = (next: OrderState) => {
    setOrder(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const moveAction = (key: string, targetList: "pinned" | "more", targetIndex: number) => {
    const next: OrderState = { pinned: [...order.pinned], more: [...order.more] };
    const fromPinned = next.pinned.indexOf(key);
    const fromMore = next.more.indexOf(key);
    if (fromPinned >= 0) next.pinned.splice(fromPinned, 1);
    if (fromMore >= 0) next.more.splice(fromMore, 1);
    const dest = targetList === "pinned" ? next.pinned : next.more;
    const clamped = Math.max(0, Math.min(targetIndex, dest.length));
    dest.splice(clamped, 0, key);
    persistOrder(next);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq(relatedKey, relatedId);
    if (error) toast.error(error.message);
    const rows = ((data as Activity[]) ?? []).slice().sort((a, b) => {
      const ta = new Date(a.hs_createdate ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.hs_createdate ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });
    setItems(rows);
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

  // Load workspace members for @mentions and task assignment
  useEffect(() => {
    if (!user) return;
    (async () => {
      const list: TeamMember[] = [{ id: user.id, name: user.email ?? "Você" }];
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      const wsId = (profile as { active_workspace_id?: string } | null)?.active_workspace_id;
      if (wsId) {
        const { data: wm } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", wsId);
        const ids = [...new Set((wm ?? []).map((t) => t.user_id))];
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          for (const p of profs ?? []) {
            if (!list.find((x) => x.id === p.id)) list.push({ id: p.id, name: p.full_name ?? p.id });
          }
        }
      }
      setTeam(list);
    })();
  }, [user]);


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
      owner_id: type === "task" && assigneeId ? assigneeId : user.id,
      created_by: user.id,
      type,
      subject: subject || null,
      body: body || null,
      due_date: type === "task" && dueDate ? new Date(dueDate).toISOString() : null,
      mentions: extractMentionIds(body),
      attachments,
      ...autoLinks,
    };
    const { error } = await supabase.from("activities").insert(payload as never);
    if (error) return toast.error(error.message);
    setSubject(""); setBody(""); setDueDate(""); setAssigneeId(""); setPendingFiles([]); setMentions([]);
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


  const pickLog = (kind: LogKind) => {
    setType(kind);
    setComposerOpen(true);
    setMoreOpen(false);
  };

  const pickCreate = (action: CreateAction) => {
    setMoreOpen(false);
    setOpenAction(action);
  };

  const handleBarClick = (a: BarAction) => {
    if (a.kind === "log") pickLog(a.value);
    else pickCreate(a.value);
  };

  const currentLogLabel = LOG_LABEL[type] ?? "Atividade";

  const [moreQuery, setMoreQuery] = useState("");

  const onDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("text/x-action-key", key);
    e.dataTransfer.effectAllowed = "move";
    setDragKey(key);
  };
  const onDragEnd = () => setDragKey(null);
  const allowDrop = (e: React.DragEvent) => {
    if (dragKey || e.dataTransfer.types.includes("text/x-action-key")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };
  const dropOnItem = (e: React.DragEvent, list: "pinned" | "more", index: number) => {
    const key = e.dataTransfer.getData("text/x-action-key") || dragKey;
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    moveAction(key, list, index);
    setDragKey(null);
  };
  const dropOnList = (e: React.DragEvent, list: "pinned" | "more") => {
    const key = e.dataTransfer.getData("text/x-action-key") || dragKey;
    if (!key) return;
    e.preventDefault();
    moveAction(key, list, (list === "pinned" ? order.pinned : order.more).length);
    setDragKey(null);
  };

  const renderCircleButton = (a: BarAction, active: boolean, index: number) => {
    const key = actionKey(a);
    const isDragging = dragKey === key;
    return (
      <button
        key={key}
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, key)}
        onDragEnd={onDragEnd}
        onDragOver={allowDrop}
        onDrop={(e) => dropOnItem(e, "pinned", index)}
        onClick={() => handleBarClick(a)}
        disabled={a.kind === "create" && a.disabled}
        title={a.kind === "create" && a.disabled ? "Em breve" : `${a.label} (arraste para reordenar)`}
        className={`flex flex-col items-center gap-1.5 w-16 shrink-0 group cursor-grab active:cursor-grabbing ${
          a.kind === "create" && a.disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <span
          className={`flex items-center justify-center h-12 w-12 rounded-full border transition-all ${
            active
              ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/30"
              : "bg-muted/60 border-border/60 text-foreground/80 group-hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
          }`}
        >
          {a.icon}
        </span>
        <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight line-clamp-2">
          {a.label}
        </span>
      </button>
    );
  };

  const pinnedActions = order.pinned.map((k) => ACTIONS_BY_KEY[k]).filter(Boolean);
  const moreActions = order.more.map((k) => ACTIONS_BY_KEY[k]).filter(Boolean);
  const moreFiltered = moreActions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.label.toLowerCase().includes(moreQuery.toLowerCase()));

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
        {/* HubSpot-style action bar */}
        <div
          className="px-4 pt-4 pb-3 flex items-start gap-3 overflow-x-auto"
          onDragOver={allowDrop}
          onDrop={(e) => dropOnList(e, "pinned")}
        >
          {pinnedActions.map((a, i) =>
            renderCircleButton(a, composerOpen && a.kind === "log" && a.value === type, i)
          )}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Mais"
                className="flex flex-col items-center gap-1.5 w-16 shrink-0 group"
              >
                <span className={`flex items-center justify-center h-12 w-12 rounded-full border transition-all ${
                  moreOpen
                    ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/30"
                    : "bg-muted/60 border-border/60 text-foreground/80 group-hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
                }`}>
                  <MoreHorizontal className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">Mais</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <div className="p-2 border-b">
                <Input
                  value={moreQuery}
                  onChange={(e) => setMoreQuery(e.target.value)}
                  placeholder="Pesquisar"
                  className="h-8"
                />
              </div>
              <div
                className="max-h-80 overflow-y-auto py-1"
                onDragOver={allowDrop}
                onDrop={(e) => dropOnList(e, "more")}
              >
                {moreFiltered.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma ação encontrada.</p>
                )}
                {moreFiltered.map(({ a, i }) => {
                  const key = actionKey(a);
                  const disabled = a.kind === "create" && a.disabled;
                  const isDragging = dragKey === key;
                  return (
                    <div
                      key={`m-${key}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, key)}
                      onDragEnd={onDragEnd}
                      onDragOver={allowDrop}
                      onDrop={(e) => dropOnItem(e, "more", i)}
                      onClick={() => { if (!disabled) handleBarClick(a); }}
                      className={`flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted ${
                        disabled ? "opacity-50 cursor-not-allowed" : ""
                      } ${isDragging ? "opacity-40" : ""}`}
                      title="Arraste para reordenar ou para a barra"
                    >
                      <span className="text-muted-foreground">{a.icon}</span>
                      <span className="flex-1 text-sm">{a.label}</span>
                      {disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>


        {/* Inline composer (only when a "log" action is selected) */}
        {composerOpen && (
          <div className="border-t border-border/60 p-4 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-primary">{ICONS[type]}</span>
                {currentLogLabel}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setComposerOpen(false); setSubject(""); setBody(""); setDueDate(""); setPendingFiles([]); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Assunto (opcional)" value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 min-w-[200px]" />
              {type === "task" && (
                <>
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-56" />
                  <select
                    value={assigneeId || user?.id || ""}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    title="Atribuir tarefa para"
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.id === user?.id ? " (você)" : ""}
                      </option>
                    ))}
                  </select>
                </>
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
                mentions={team}
                onMentionAdd={(m) => {
                  if (!mentions.find((x) => x.id === m.id)) setMentions((prev) => [...prev, m]);
                }}
              />
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
              <Button
                onClick={async () => { await add(); setComposerOpen(false); }}
                size="sm"
                className="rounded-xl shadow-md shadow-primary/20 font-semibold"
              >
                Salvar {currentLogLabel}
              </Button>
            </div>
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
      <SendEmailDialog
        open={openAction === "email"}
        onOpenChange={(v) => !v && setOpenAction(null)}
        defaultTo={target.email ?? ""}
        contactId={target.contactId}
        contactName={target.name}
      />
      {openAction === "call" && !target.phone && (() => {
        toast.error("Sem telefone disponível para esta entidade.");
        setTimeout(() => setOpenAction(null), 0);
        return null;
      })()}
      {target.phone && (
        <CallDialer
          open={openAction === "call"}
          onOpenChange={(v) => !v && setOpenAction(null)}
          defaultTo={target.phone}
          contactId={target.contactId}
          contactName={target.name}
        />
      )}
      {openAction === "whatsapp" && !target.phone && (() => {
        toast.error("Sem telefone disponível para esta entidade.");
        setTimeout(() => setOpenAction(null), 0);
        return null;
      })()}
      {target.phone && (
        <SendWhatsAppDialog
          open={openAction === "whatsapp"}
          onOpenChange={(v) => !v && setOpenAction(null)}
          defaultTo={target.phone}
          contactId={target.contactId}
          contactName={target.name}
        />
      )}


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
                        <RichHtmlEditor value={editingBody} onChange={setEditingBody} minHeight={120} mentions={team} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(a)}><Check className="h-3 w-3 mr-1" /> Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <HtmlContent html={a.body} className="text-sm text-foreground/90 mt-1" />
                    )
                  )}
                  {a.type === "call" && (a.duration_ms || a.disposition) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {a.disposition && (
                        <Badge variant="secondary" className="text-[10px]">{a.disposition}</Badge>
                      )}
                      {a.duration_ms != null && a.duration_ms > 0 && (
                        <span className="text-muted-foreground">
                          {Math.floor(a.duration_ms / 60000)}m {Math.floor((a.duration_ms % 60000) / 1000)}s
                        </span>
                      )}
                    </div>
                  )}
                  {a.type === "call" && a.recording_url && (
                    <div className="mt-3">
                      <audio
                        controls
                        preload="none"
                        src={a.recording_url}
                        className="w-full h-10"
                      />
                    </div>
                  )}
                  {a.type === "email" && (a.email_direction || a.email_status) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {a.email_direction && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {a.email_direction === "inbound" ? "recebido" : a.email_direction === "outbound" ? "enviado" : a.email_direction}
                        </Badge>
                      )}
                      {a.email_status && (
                        <Badge variant="secondary" className="text-[10px] capitalize">{a.email_status}</Badge>
                      )}
                    </div>
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
