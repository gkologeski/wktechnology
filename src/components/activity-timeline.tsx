import { useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RichHtmlEditor, HtmlContent, extractMentionIds, sanitizeHtml as sanitizeEmailHtml } from "@/components/rich-html-editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { signMeetingRecording, generateMeetingSummary, summarizeCalendarEventRecording } from "@/lib/meetings.functions";
import { notifyActivityEvent } from "@/lib/notifications.functions";
import { AttachmentPreview } from "@/components/timeline/attachment-preview";
import { ActivityComments } from "@/components/timeline/activity-comments";
import { maybeConvertWhatsAppPaste } from "@/lib/whatsapp-paste";
import {
  StickyNote,
  ListTodo,
  Phone,
  Mail,
  CalendarDays,
  Trash2,
  Paperclip,
  AtSign,
  X,
  Download,
  Pencil,
  Check,
  MessageSquare,
  MessageCircle,
  Linkedin,
  Send,
  Inbox,
  Workflow,
  MoreHorizontal,
  Lock,
  Sparkles,
  Link as LinkIcon,
  Users,
  User,
  Video,
  Zap,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  File as FileIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarRange, Filter, Loader2 } from "lucide-react";
import { DateFilter } from "@/components/date-filter";
import {
  DATE_PRESET_LABELS,
  getDateRange,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";

import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { CallDialer } from "@/components/voice/call-dialer";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { StartVideoButton } from "@/components/meetings/start-video-button";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { Eye, MousePointerClick } from "lucide-react";

type EmailMeta = {
  direction: "inbound" | "outbound" | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  body_html: string | null;
  body_text: string | null;
  sent_at: string | null;
  received_at: string | null;
  open_count: number;
  click_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  last_clicked_url: string | null;
  has_attachments: boolean;
  attachments: Array<{ path?: string; filename: string; content_type?: string; size?: number }>;
};

function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function openEmailAttachment(path: string | undefined) {
  if (!path) return;
  const { data, error } = await supabase.storage
    .from("email-attachments")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? "Falha ao abrir anexo");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

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

type RelatedKey =
  | "related_lead_id"
  | "related_contact_id"
  | "related_company_id"
  | "related_deal_id"
  | "related_ticket_id";
type Attachment = { path: string; name: string; size: number; type: string; bucket?: string };
type TeamMember = { id: string; name: string };
type CalendarAttendee = { email?: string; displayName?: string; organizer?: boolean; self?: boolean };

function normalizeTimelineEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

type TaskDuePreset = "custom" | "today" | "tomorrow" | "next_week" | "next_month" | "in_3_months";

const TASK_DUE_PRESET_LABELS: Record<TaskDuePreset, string> = {
  custom: "Personalizada",
  today: "Hoje",
  tomorrow: "Amanhã",
  next_week: "Semana que vem",
  next_month: "Mês que vem",
  in_3_months: "Daqui 3 meses",
};

function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function computeDuePreset(preset: TaskDuePreset, baseIso: string | null): string | null {
  if (preset === "custom") return baseIso;
  const now = new Date();
  const base = baseIso ? new Date(baseIso) : now;
  const hours = base.getHours();
  const minutes = base.getMinutes();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (preset === "today") {
    return target.toISOString();
  }
  if (preset === "tomorrow") {
    target.setDate(target.getDate() + 1);
    return target.toISOString();
  }
  if (preset === "next_week") {
    const day = target.getDay(); // 0=Sun..6=Sat
    const daysUntilNextMonday = day === 1 ? 7 : ((8 - day) % 7) || 7;
    target.setDate(target.getDate() + daysUntilNextMonday);
    return target.toISOString();
  }
  if (preset === "next_month") {
    return addMonthsClamped(target, 1).toISOString();
  }
  if (preset === "in_3_months") {
    return addMonthsClamped(target, 3).toISOString();
  }
  return baseIso;
}



function emailDomain(email: string | null | undefined) {
  return normalizeTimelineEmail(email).split("@")[1] ?? "";
}

function calendarAttendees(value: unknown): CalendarAttendee[] {
  return Array.isArray(value) ? (value as CalendarAttendee[]) : [];
}

function calendarInternalDomains(attendees: CalendarAttendee[]) {
  const domains = new Set<string>();
  for (const attendee of attendees) {
    if (!attendee.email || (!attendee.self && !attendee.organizer)) continue;
    const domain = emailDomain(attendee.email);
    if (domain) domains.add(domain);
  }
  return domains;
}

function calendarEventTargetsEmails(
  event: Record<string, unknown>,
  targetEmails: Set<string>,
  targetContactIds: Set<string>,
  contactEmailById: Map<string, string>,
) {
  const attendees = calendarAttendees(event.attendees);
  const attendeeEmails = new Set(
    attendees.map((a) => normalizeTimelineEmail(a.email)).filter(Boolean),
  );
  const internalDomains = calendarInternalDomains(attendees);
  const isExternalTarget = (email: string) => {
    const domain = emailDomain(email);
    return !!domain && !internalDomains.has(domain);
  };

  for (const email of targetEmails) {
    if (attendeeEmails.has(email) && isExternalTarget(email)) return true;
  }

  const relatedContactId = typeof event.related_contact_id === "string" ? event.related_contact_id : null;
  const relatedEmail = relatedContactId ? contactEmailById.get(relatedContactId) : null;
  return (
    !!relatedContactId &&
    targetContactIds.has(relatedContactId) &&
    !!relatedEmail &&
    isExternalTarget(relatedEmail)
  );
}

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
  {
    kind: "create",
    value: "meeting",
    label: "Reunião",
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    kind: "create",
    value: "whatsapp",
    label: "Enviar WhatsApp",
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    kind: "create",
    value: "sequence",
    label: "Inscrever em sequência",
    icon: <Workflow className="h-5 w-5" />,
    disabled: true,
  },
  {
    kind: "create",
    value: "linkedin",
    label: "Envolva-se no LinkedIn",
    icon: <Linkedin className="h-5 w-5" />,
    disabled: true,
  },
  { kind: "log", value: "email", label: "Registrar e-mail", icon: <Mail className="h-5 w-5" /> },
  { kind: "log", value: "call", label: "Registrar chamada", icon: <Phone className="h-5 w-5" /> },
  {
    kind: "log",
    value: "meeting",
    label: "Registrar reunião",
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    kind: "log",
    value: "whatsapp",
    label: "Registrar conversa do WhatsApp",
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    kind: "log",
    value: "sms",
    label: "Registrar SMS",
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    kind: "log",
    value: "linkedin_message",
    label: "Registrar mensagem do LinkedIn",
    icon: <Linkedin className="h-5 w-5" />,
  },
  {
    kind: "log",
    value: "postal_mail",
    label: "Registrar correio postal",
    icon: <Inbox className="h-5 w-5" />,
  },
];
const ACTIONS_BY_KEY: Record<string, BarAction> = Object.fromEntries(
  ALL_ACTIONS.map((a) => [actionKey(a), a]),
);

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

// ============ Email timeline item (Gmail-like) ============

function initialsFromEmail(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  if (!src) return "?";
  const parts = src.replace(/@.*$/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  const hue = h % 360;
  return `hsl(${hue} 55% 45%)`;
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attachmentIcon(filename: string, contentType?: string) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
  if (ct === "application/pdf" || ext === "pdf") return FileText;
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || ct.includes("spreadsheet") || ct.includes("excel")) return FileSpreadsheet;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || ct.includes("zip") || ct.includes("compressed")) return Archive;
  if (["doc", "docx", "txt", "rtf", "odt"].includes(ext) || ct.includes("word") || ct.startsWith("text/")) return FileText;
  return FileIcon;
}

function EmailTimelineItem({
  meta,
  createdAt,
  onOpenAttachment,
}: {
  meta: EmailMeta;
  createdAt: string | null;
  onOpenAttachment: (path: string | undefined) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(160);
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [headerOpen, setHeaderOpen] = useState<boolean>(false);

  const isOut = meta.direction === "outbound";
  const displayName = isOut
    ? (meta.from_name || meta.from_email || "Você")
    : (meta.from_name || meta.from_email || "Remetente");
  const displayEmail = meta.from_email ?? "";
  const dateStr = createdAt
    ? formatDateTime(meta.sent_at || meta.received_at || createdAt)
    : "";
  const toList = meta.to_emails ?? [];
  const primaryTo = toList[0] ?? "—";
  const extraToCount = Math.max(0, toList.length - 1);

  const srcDoc = useMemo(() => {
    const rawHtml = meta.body_html?.trim();
    const rawText = meta.body_text?.trim();
    let inner = "";
    if (rawHtml) {
      inner = sanitizeEmailHtml(rawHtml);
    } else if (rawText) {
      inner = `<div style="white-space:pre-wrap">${escapeHtmlText(rawText)}</div>`;
    } else {
      inner = `<p style="color:#888">(sem conteúdo)</p>`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
      html,body{margin:0;padding:12px;background:transparent;color:#111;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
      @media (prefers-color-scheme: dark){html,body{color:#e5e7eb}}
      img,video,table{max-width:100%!important;height:auto}
      table{border-collapse:collapse}
      a{color:#2563eb}
      blockquote{border-left:3px solid #e5e7eb;margin:8px 0;padding:2px 10px;color:#6b7280}
      pre,code{white-space:pre-wrap;word-break:break-word}
    </style></head><body>${inner}</body></html>`;
  }, [meta.body_html, meta.body_text]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let raf = 0;
    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = Math.min(2400, Math.max(80, doc.documentElement.scrollHeight));
        setIframeHeight(h);
        setCollapsed(h > 460);
      } catch {
        /* cross-origin — srcDoc should be same-origin sandbox */
      }
    };
    const onLoad = () => {
      measure();
      raf = window.setTimeout(measure, 120) as unknown as number;
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      if (raf) window.clearTimeout(raf);
    };
  }, [srcDoc]);

  const maxH = collapsed ? 460 : iframeHeight + 8;

  return (
    <div className="mt-1 rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback
            className="text-xs font-medium text-white"
            style={{ backgroundColor: colorFromString(displayEmail || displayName) }}
          >
            {initialsFromEmail(meta.from_name, meta.from_email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm">
                <span className="font-semibold text-foreground">{displayName}</span>
                {displayEmail && displayEmail !== displayName && (
                  <span className="ml-1 text-muted-foreground">&lt;{displayEmail}&gt;</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHeaderOpen((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">
                  para {primaryTo}
                  {extraToCount > 0 ? `, +${extraToCount}` : ""}
                </span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", headerOpen && "rotate-180")} />
              </button>
              {headerOpen && (
                <div className="mt-1 space-y-0.5 rounded-md border border-border/50 bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  <div>
                    <span className="text-foreground/70">De: </span>
                    {meta.from_name ? `${meta.from_name} <${meta.from_email ?? ""}>` : (meta.from_email ?? "—")}
                  </div>
                  <div>
                    <span className="text-foreground/70">Para: </span>
                    {toList.join(", ") || "—"}
                  </div>
                  {meta.cc_emails.length > 0 && (
                    <div>
                      <span className="text-foreground/70">Cc: </span>
                      {meta.cc_emails.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              {meta.has_attachments && <Paperclip className="h-3.5 w-3.5" />}
              <span>{dateStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="relative border-t border-border/60">
        <div
          className="overflow-hidden transition-[max-height] duration-200"
          style={{ maxHeight: maxH }}
        >
          <iframe
            ref={iframeRef}
            title="E-mail"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="w-full border-0"
            style={{ height: iframeHeight }}
          />
        </div>
        {iframeHeight > 460 && (
          <>
            {collapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-8 h-10 bg-gradient-to-t from-card to-transparent" />
            )}
            <div className="flex justify-center border-t border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {collapsed ? "Ver mensagem completa" : "Recolher"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Attachments */}
      {meta.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 p-3">
          {meta.attachments.map((att, i) => {
            const Icon = attachmentIcon(att.filename, att.content_type);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onOpenAttachment(att.path)}
                disabled={!att.path}
                title={att.path ? "Baixar anexo" : "Anexo indisponível"}
                className="group flex w-[260px] items-center gap-2.5 rounded-md border border-border/60 bg-muted/30 p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{att.filename}</div>
                  {att.size ? (
                    <div className="text-[11px] text-muted-foreground">{formatBytes(att.size)}</div>
                  ) : null}
                </div>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {/* Metrics (outbound only) */}
      {isOut && (meta.open_count > 0 || meta.click_count > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {meta.open_count} abertura{meta.open_count === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3 w-3" />
            {meta.click_count} clique{meta.click_count === 1 ? "" : "s"}
          </span>
          {meta.last_opened_at && (
            <span>Última abertura em {formatDateTime(meta.last_opened_at)}</span>
          )}
          {meta.last_clicked_at && (
            <span className="truncate">
              Último clique em {formatDateTime(meta.last_clicked_at)}
              {meta.last_clicked_url ? ` · ${meta.last_clicked_url}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}



export function ActivityTimeline({
  relatedKey,
  relatedId,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  // Metadados enriquecidos de e-mails (corpo, anexos, aberturas, cliques),
  // indexados pelo id da atividade correspondente.
  const [emailMeta, setEmailMeta] = useState<Map<string, EmailMeta>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
  const [editingAttachments, setEditingAttachments] = useState<Attachment[]>([]);
  const [editingNewFiles, setEditingNewFiles] = useState<File[]>([]);
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null);
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null);

  const notifyActivityEventFn = useServerFn(notifyActivityEvent);

  // Action dialogs open state
  const [openAction, setOpenAction] = useState<CreateAction | null>(null);

  // Contact info resolved from parent entity for action dialogs
  const [target, setTarget] = useState<{
    email?: string;
    phone?: string;
    contactId?: string;
    name?: string;
  }>({});

  // Ordem reorganizável das ações (persistida em localStorage)
  const [order, setOrder] = useState<OrderState>(() => loadOrder());
  const [dragKey, setDragKey] = useState<string | null>(null);

  // Filtro de período da timeline (presets + datas customizadas)
  const [datePreset, setDatePreset] = useState<DatePreset>("any");
  const [dateCustom, setDateCustom] = useState<CustomRange>({});
  const [dateOpen, setDateOpen] = useState(false);

  const persistOrder = (next: OrderState) => {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
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

  const load = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    const { data, error } = await supabase.from("activities").select("*").eq(relatedKey, relatedId);


    if (error) toast.error(error.message);
    let baseRows = ((data as Activity[]) ?? []).slice();
    const emailMessageIds = [
      ...new Set(
        baseRows
          .map((row) => {
            const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
            return typeof ext.email_message_id === "string" ? ext.email_message_id : null;
          })
          .filter(Boolean) as string[],
      ),
    ];
    const nextEmailMeta = new Map<string, EmailMeta>();
    if (emailMessageIds.length > 0) {
      const [{ data: messages }, { data: events }] = await Promise.all([
        supabase
          .from("email_messages")
          .select(
            "id, direction, from_email, from_name, to_emails, cc_emails, body_html, body_text, sent_at, received_at, open_count, click_count, first_opened_at, has_attachments, attachments",
          )
          .in("id", emailMessageIds),
        supabase
          .from("email_tracking_events")
          .select("message_id, event_type, url, occurred_at")
          .in("message_id", emailMessageIds)
          .order("occurred_at", { ascending: false }),
      ]);
      type MsgRow = {
        id: string;
        direction: string | null;
        from_email: string | null;
        from_name: string | null;
        to_emails: string[] | null;
        cc_emails: string[] | null;
        body_html: string | null;
        body_text: string | null;
        sent_at: string | null;
        received_at: string | null;
        open_count: number | null;
        click_count: number | null;
        first_opened_at: string | null;
        has_attachments: boolean | null;
        attachments: unknown;
      };
      const messageById = new Map(
        ((messages ?? []) as MsgRow[]).map((m) => [m.id, m]),
      );
      type EvRow = { message_id: string; event_type: string; url: string | null; occurred_at: string };
      const lastOpen = new Map<string, string>();
      const lastClick = new Map<string, { at: string; url: string | null }>();
      for (const e of (events ?? []) as EvRow[]) {
        if (e.event_type === "open" && !lastOpen.has(e.message_id)) {
          lastOpen.set(e.message_id, e.occurred_at);
        } else if (e.event_type === "click" && !lastClick.has(e.message_id)) {
          lastClick.set(e.message_id, { at: e.occurred_at, url: e.url });
        }
      }
      baseRows = baseRows.map((row) => {
        if (row.type !== "email") return row;
        const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
        const messageId = typeof ext.email_message_id === "string" ? ext.email_message_id : null;
        const message = messageId ? messageById.get(messageId) : null;
        if (!message) return row;
        const attachmentsRaw = Array.isArray(message.attachments)
          ? (message.attachments as Array<Record<string, unknown>>)
          : [];
        const attachments = attachmentsRaw.map((a) => ({
          path: typeof a.path === "string" ? a.path : undefined,
          filename: typeof a.filename === "string" ? a.filename : "arquivo",
          content_type: typeof a.content_type === "string" ? a.content_type : undefined,
          size: typeof a.size === "number" ? a.size : undefined,
        }));
        const click = lastClick.get(message.id);
        const dir = message.direction === "inbound" || message.direction === "outbound" ? message.direction : null;
        nextEmailMeta.set(row.id, {
          direction: dir,
          from_email: message.from_email,
          from_name: message.from_name,
          to_emails: message.to_emails ?? [],
          cc_emails: message.cc_emails ?? [],
          body_html: message.body_html,
          body_text: message.body_text,
          sent_at: message.sent_at,
          received_at: message.received_at,
          open_count: Number(message.open_count ?? 0),
          click_count: Number(message.click_count ?? 0),
          first_opened_at: message.first_opened_at,
          last_opened_at: lastOpen.get(message.id) ?? null,
          last_clicked_at: click?.at ?? null,
          last_clicked_url: click?.url ?? null,
          has_attachments: Boolean(message.has_attachments),
          attachments,
        });
        const html = message.body_html?.trim() ? message.body_html : message.body_text;
        return html ? ({ ...row, body: html } as Activity) : row;
      });
    }
    setEmailMeta(nextEmailMeta);

    // Mirror Google Calendar events via the unified `get_entity_timeline` RPC.
    // The RPC resolves the relationship graph (Deal → Contacts → Company, etc.)
    // server-side, so any meeting linked to a related contact appears on this
    // entity's timeline without duplicating records.
    let calendarVirtuals: Activity[] = [];
    try {
      const kindMap: Record<RelatedKey, string> = {
        related_lead_id: "lead",
        related_contact_id: "contact",
        related_company_id: "company",
        related_deal_id: "deal",
        related_ticket_id: "ticket",
      };
      const { start, end } = getDateRange(datePreset, new Date(), dateCustom);
      const { data: tl, error: tlErr } = await supabase.rpc("get_entity_timeline", {
        p_entity_kind: kindMap[relatedKey],
        p_entity_id: relatedId,
        p_since: start ? start.toISOString() : undefined,
        p_until: end ? end.toISOString() : undefined,
        p_limit: 300,
      });
      if (tlErr) throw tlErr;
      const calRows = ((tl ?? []) as Array<{ id: string; source: string }>).filter(
        (r) => r.source === "calendar_event",
      );
      const calIdsFromRpc = calRows
        .map((r) => r.id.replace(/^cal_/, ""))
        .filter(Boolean);
      const existingCalIds = new Set(
        baseRows
          .map((row) => {
            const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
            return typeof ext.calendar_event_id === "string" ? ext.calendar_event_id : null;
          })
          .filter(Boolean) as string[],
      );
      // Fetch calendar_events referenced by RPC virtuals AND by real activities in baseRows.
      // Real activities may be missing recording_url when the recording was found after the
      // activity was created; we use the event as fallback.
      const calIds = Array.from(new Set([...calIdsFromRpc, ...existingCalIds]));
      if (calIds.length > 0) {
        const selectCols =
          "id, title, description, start_at, end_at, location, html_link, hangout_link, attendees, recording_url, related_contact_id, created_at";
        const { data: events } = await supabase
          .from("calendar_events")
          .select(selectCols)
          .in("id", calIds);
        const eventsById = new Map<string, Record<string, unknown>>();
        for (const e of (events ?? []) as Array<Record<string, unknown>>) {
          eventsById.set(e.id as string, e);
        }
        // Enrich real activities that already exist in baseRows with recording_url fallback.
        for (const row of baseRows) {
          const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
          const cid = typeof ext.calendar_event_id === "string" ? (ext.calendar_event_id as string) : null;
          if (!cid) continue;
          const ev = eventsById.get(cid);
          if (!ev) continue;
          const evRec = (ev.recording_url as string | null) ?? null;
          if (!evRec) continue;
          const r = row as unknown as {
            recording_url?: string | null;
            attachments?: Record<string, unknown> | null;
            external_ids?: Record<string, unknown> | null;
          };
          const atts = { ...((r.attachments ?? {}) as Record<string, unknown>) };
          const ex = { ...((r.external_ids ?? {}) as Record<string, unknown>) };
          if (!atts.recording_url) atts.recording_url = evRec;
          if (!ex.recording_url) ex.recording_url = evRec;
          r.attachments = atts;
          r.external_ids = ex;
          if (!r.recording_url) r.recording_url = evRec;
        }
        calendarVirtuals = Array.from(eventsById.values())
          .filter((e) => !existingCalIds.has(e.id as string))
          .map((e) => {
            const atts = calendarAttendees(e.attendees);
            return {
              id: `cal_${e.id as string}`,
              type: "meeting",
              subject: (e.title as string) ?? "Reunião (Google Calendar)",
              body: (e.description as string) ?? "",
              due_date: (e.start_at as string) ?? null,
              created_at: (e.start_at as string) ?? (e.created_at as string),
              hs_createdate: (e.start_at as string) ?? (e.created_at as string),
              meeting_location: (e.location as string) ?? (e.hangout_link as string) ?? null,
              external_ids: {
                source: "google_calendar",
                calendar_event_id: e.id,
                gcal_html_link: e.html_link ?? null,
                recording_url: e.recording_url ?? null,
              },
              attachments: {
                end_at: e.end_at ?? null,
                meet_link: e.hangout_link ?? null,
                calendar_html_link: e.html_link ?? null,
                recording_url: e.recording_url ?? null,
                attendees: atts
                  .filter((a) => a.email)
                  .map((a) => ({ email: a.email, name: a.displayName })),
              },
              completed: false,
              owner_id: null,
              [relatedKey]: relatedId,
            } as unknown as Activity;
          });
      }

    } catch (e) {
      console.error("[timeline] mirrored events load", e);
    }

    // Apply the date-range filter to direct activity rows as well.
    const { start: filtStart, end: filtEnd } = getDateRange(
      datePreset,
      new Date(),
      dateCustom,
    );
    const inRange = (iso: string | null | undefined) => {
      if (!iso) return !filtStart && !filtEnd;
      const t = new Date(iso).getTime();
      if (filtStart && t < filtStart.getTime()) return false;
      if (filtEnd && t >= filtEnd.getTime()) return false;
      return true;
    };
    const filteredBase =
      datePreset === "any"
        ? baseRows
        : baseRows.filter((row) => inRange(row.hs_createdate ?? row.created_at));

    const rows = [...filteredBase, ...calendarVirtuals].sort((a, b) => {
      const ta = new Date(a.hs_createdate ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.hs_createdate ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });
    setItems(rows);
    setLoading(false);
    setRefreshing(false);
  };


  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [relatedId, datePreset, dateCustom.start, dateCustom.end]);

  // Recarrega quando uma associação é criada/removida em outro componente
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load({ silent: true });
      }, 150);
    };
    window.addEventListener("timeline:refresh", handler);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("timeline:refresh", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedId, datePreset, dateCustom.start, dateCustom.end]);



  // Resolve email/phone/contact from parent entity for the "Criar" actions
  useEffect(() => {
    (async () => {
      try {
        if (relatedKey === "related_lead_id") {
          const { data } = await supabase
            .from("leads")
            .select("email, phone, first_name, last_name")
            .eq("id", relatedId)
            .maybeSingle();
          if (data)
            setTarget({
              email: data.email ?? undefined,
              phone: data.phone ?? undefined,
              name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
            });
        } else if (relatedKey === "related_contact_id") {
          const { data } = await supabase
            .from("contacts")
            .select("id, email, phone, mobile_phone, first_name, last_name")
            .eq("id", relatedId)
            .maybeSingle();
          if (data)
            setTarget({
              email: data.email ?? undefined,
              phone: data.phone ?? data.mobile_phone ?? undefined,
              contactId: data.id,
              name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
            });
        } else if (relatedKey === "related_company_id") {
          const { data } = await supabase
            .from("companies")
            .select("phone, name")
            .eq("id", relatedId)
            .maybeSingle();
          if (data) setTarget({ phone: data.phone ?? undefined, name: data.name ?? undefined });
        } else if (relatedKey === "related_deal_id") {
          const { data: d } = await supabase
            .from("deals")
            .select("primary_contact_id, name")
            .eq("id", relatedId)
            .maybeSingle();
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
          if (contactId) {
            const { data: c } = await supabase
              .from("contacts")
              .select("id, email, phone, mobile_phone, first_name, last_name")
              .eq("id", contactId)
              .maybeSingle();
            if (c)
              setTarget({
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
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          for (const p of profs ?? []) {
            if (!list.find((x) => x.id === p.id))
              list.push({ id: p.id, name: p.full_name ?? p.id });
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
      const safeName = file.name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(-120) || "file";
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("notes-attachments")
        .upload(path, file, { contentType: file.type });
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
      /* default link already set */
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
    const waHtml = body ? maybeConvertWhatsAppPaste(body) : null;
    const finalBody = waHtml ?? (body || null);
    const payload: Record<string, unknown> = {
      owner_id: type === "task" && assigneeId ? assigneeId : user.id,
      created_by: user.id,
      type,
      subject: subject || (waHtml ? "Conversa de WhatsApp" : null),
      body: finalBody,
      due_date: type === "task" && dueDate ? new Date(dueDate).toISOString() : null,
      mentions: waHtml ? [] : extractMentionIds(body),
      attachments,
      ...autoLinks,
    };
    const { data: inserted, error } = await supabase
      .from("activities")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    if (inserted?.id) {
      void notifyActivityEventFn({ data: { activityId: inserted.id } }).catch(() => {});
    }
    setSubject("");
    setBody("");
    setDueDate("");
    setAssigneeId("");
    setPendingFiles([]);
    setMentions([]);
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

  const toggleDone = async (a: Activity) => {
    const { error } = await supabase
      .from("activities")
      .update({ completed: !a.completed })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setEditingBody(a.body ?? "");
    const existing = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
    setEditingAttachments(existing);
    setEditingNewFiles([]);
    setEditingAssigneeId(a.type === "task" ? ((a as unknown as { owner_id?: string | null }).owner_id ?? null) : null);
    setEditingDueDate(a.type === "task" ? (a.due_date ?? null) : null);
  };


  const uploadEditingFiles = async (): Promise<Attachment[]> => {
    if (!user || editingNewFiles.length === 0) return [];
    const out: Attachment[] = [];
    for (const file of editingNewFiles) {
      const safeName =
        file.name
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(-120) || "file";
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("notes-attachments")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Falha em ${file.name}: ${error.message}`);
        continue;
      }
      out.push({ path, name: file.name, size: file.size, type: file.type });
    }
    return out;
  };

  const saveEdit = async (a: Activity) => {
    const uploaded = await uploadEditingFiles();
    const finalAttachments = [...editingAttachments, ...uploaded];
    const patch: Record<string, unknown> = {
      body: editingBody || null,
      attachments: finalAttachments,
    };
    if (a.type === "task") {
      patch.owner_id = editingAssigneeId ?? user?.id ?? null;
      patch.due_date = editingDueDate ? new Date(editingDueDate).toISOString() : null;
    }
    const { error } = await supabase
      .from("activities")
      .update(patch as never)
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    setEditingAttachments([]);
    setEditingNewFiles([]);
    setEditingAssigneeId(null);
    setEditingDueDate(null);
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };


  const signMeetingRec = useServerFn(signMeetingRecording);
  const summarizeMeetingFn = useServerFn(generateMeetingSummary);
  const summarizeCalEventFn = useServerFn(summarizeCalendarEventRecording);
  const onSummarizeMeeting = async (activityId: string) => {
    const a = items.find((i) => i.id === activityId);
    const ext = ((a as unknown as { external_ids?: Record<string, unknown> } | undefined)?.external_ids ?? {}) as Record<string, unknown>;
    const meetingId = typeof ext.meeting_id === "string" ? (ext.meeting_id as string) : null;
    const calendarEventId = typeof ext.calendar_event_id === "string" ? (ext.calendar_event_id as string) : null;
    try {
      if (meetingId) {
        toast.message("Gerando resumo com IA…");
        await summarizeMeetingFn({ data: { meeting_id: meetingId } });
        toast.success("Resumo gerado. Veja em Reuniões.");
        return;
      }
      if (calendarEventId) {
        toast.message("Baixando gravação do Drive e gerando resumo com IA…");
        await summarizeCalEventFn({ data: { calendar_event_id: calendarEventId } });
        toast.success("Resumo gerado a partir da gravação do Drive.");
        void load();
        return;
      }
      toast.error("Esta reunião não tem gravação vinculada para resumir.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao resumir reunião");
    }
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
        title={
          a.kind === "create" && a.disabled ? "Em breve" : `${a.label} (arraste para reordenar)`
        }
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

  // Em empresas, o envio de "e-mail avulso" não é suportado — oculta a ação de criação de e-mail.
  const isCompanyContext = relatedKey === "related_company_id";
  const hideAction = (a: BarAction) =>
    isCompanyContext && a.kind === "create" && a.value === "email";
  const pinnedActions = order.pinned
    .map((k) => ACTIONS_BY_KEY[k])
    .filter((a): a is BarAction => Boolean(a) && !hideAction(a));
  const moreActions = order.more
    .map((k) => ACTIONS_BY_KEY[k])
    .filter((a): a is BarAction => Boolean(a) && !hideAction(a));
  const moreFiltered = moreActions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.label.toLowerCase().includes(moreQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div
        className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden"
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
            renderCircleButton(a, composerOpen && a.kind === "log" && a.value === type, i),
          )}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Mais"
                className="flex flex-col items-center gap-1.5 w-16 shrink-0 group"
              >
                <span
                  className={`flex items-center justify-center h-12 w-12 rounded-full border transition-all ${
                    moreOpen
                      ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/30"
                      : "bg-muted/60 border-border/60 text-foreground/80 group-hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">
                  Mais
                </span>
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
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                    Nenhuma ação encontrada.
                  </p>
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
                      onClick={() => {
                        if (!disabled) handleBarClick(a);
                      }}
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
          {(() => {
            const videoEntity =
              relatedKey === "related_contact_id"
                ? ("contact" as const)
                : relatedKey === "related_lead_id"
                  ? ("lead" as const)
                  : relatedKey === "related_deal_id"
                    ? ("deal" as const)
                    : undefined;
            return (
              <StartVideoButton
                entity={videoEntity}
                entityId={videoEntity ? relatedId : undefined}
                defaultTitle={target.name ? `Reunião com ${target.name}` : "Reunião por vídeo"}
                onCreated={() => void load()}
                renderTrigger={(openDialog) => (
                  <button
                    type="button"
                    title="Criar sala de reunião por vídeo"
                    onClick={openDialog}
                    className="flex flex-col items-center gap-1.5 w-16 shrink-0 group"
                  >
                    <span className="relative flex items-center justify-center h-12 w-12 rounded-full border border-primary/40 bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-md shadow-primary/30 transition-transform group-hover:scale-105">
                      <Video className="h-5 w-5" />
                      <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-amber-400 text-amber-950 border-2 border-card">
                        <Zap className="h-2.5 w-2.5" fill="currentColor" />
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-primary text-center leading-tight">
                      Sala agora
                    </span>
                  </button>
                )}
              />
            );
          })()}
        </div>



        {/* Inline composer (only when a "log" action is selected) */}
        {composerOpen && (
          <div className="border-t border-border/60 p-4 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-primary">{ICONS[type]}</span>
                {currentLogLabel}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setComposerOpen(false);
                  setSubject("");
                  setBody("");
                  setDueDate("");
                  setPendingFiles([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Assunto (opcional)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              {type === "task" && (
                <>
                  <Input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-56"
                  />
                  <select
                    value={assigneeId || user?.id || ""}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    title="Atribuir tarefa para"
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.id === user?.id ? " (você)" : ""}
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
                onClick={async () => {
                  await add();
                  setComposerOpen(false);
                }}
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
        leadId={relatedKey === "related_lead_id" ? relatedId : undefined}
        dealId={relatedKey === "related_deal_id" ? relatedId : undefined}
        companyId={relatedKey === "related_company_id" ? relatedId : undefined}
        contactName={target.name}
        onSent={() => void load()}
      />
      {openAction === "call" &&
        !target.phone &&
        (() => {
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
      {openAction === "whatsapp" &&
        !target.phone &&
        (() => {
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
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Timeline
        </span>
        {(() => {
          const aiEntity =
            relatedKey === "related_lead_id"
              ? "lead"
              : relatedKey === "related_contact_id"
                ? "contact"
                : relatedKey === "related_deal_id"
                  ? "deal"
                  : null;
          if (!aiEntity) return null;
          return (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Resumo IA
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Resumo IA
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <AiSummaryPanel entity={aiEntity} entityId={relatedId} />
                </div>
              </SheetContent>
            </Sheet>
          );
        })()}
        <div className="h-px flex-1 bg-border/60" />
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
              <CalendarRange className="h-3.5 w-3.5" />
              {DATE_PRESET_LABELS[datePreset] ?? "Desde sempre"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2 max-h-[60vh] overflow-y-auto">
            <div className="px-2 pb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Período da timeline
            </div>
            <DateFilter
              name="timeline-date-filter"
              value={datePreset}
              custom={dateCustom}
              onChange={({ value, custom }) => {
                setDatePreset(value);
                setDateCustom(custom);
              }}
            />
          </PopoverContent>
        </Popover>
        {refreshing && !loading && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-1" aria-live="polite">
            <Loader2 className="h-3 w-3 animate-spin" />
            Atualizando…
          </span>
        )}
      </div>



      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhuma atividade ainda.
        </div>
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
                      <h4
                        className={`text-sm font-semibold text-foreground truncate ${a.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {a.subject || ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}
                      </h4>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(a.hs_createdate ?? a.created_at)}
                      </span>
                      {a.due_date && a.type !== "meeting" && (() => {
                        const isOverdue =
                          !a.completed &&
                          new Date(a.due_date).getTime() < Date.now();
                        return (
                          <span
                            className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
                          >
                            Vence {formatDateTime(a.due_date)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {a.type === "meeting" && (() => {
                    const meta = ((a as unknown as { attachments?: unknown }).attachments ?? {}) as {
                      attendees?: Array<{ email: string; name?: string; contact_id?: string }>;
                      end_at?: string;
                      meet_link?: string;
                      calendar_html_link?: string;
                      recording_url?: string;
                    };
                    const ext = ((a as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
                    const loc = (a as unknown as { meeting_location?: string }).meeting_location;
                    // Prefer Google Calendar event link (htmlLink). Fall back to meet/Jitsi link.
                    const calendarLink =
                      meta.calendar_html_link ||
                      (typeof ext.gcal_html_link === "string" ? (ext.gcal_html_link as string) : null);
                    const joinLink = meta.meet_link || (loc && /^https?:\/\//i.test(loc) ? loc : null);
                    const accessLink = calendarLink || joinLink;
                    const recordingUrl = meta.recording_url || (typeof ext.recording_url === "string" ? (ext.recording_url as string) : null);
                    const startD = a.due_date ? new Date(a.due_date) : null;
                    const endD = meta.end_at ? new Date(meta.end_at) : null;
                    const sameDay =
                      startD && endD && startD.toDateString() === endD.toDateString();
                    const timeFmt = (d: Date) =>
                      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    const hasMeetingMeta =
                      !!startD ||
                      !!joinLink ||
                      !!loc ||
                      (meta.attendees && meta.attendees.length > 0) ||
                      !!accessLink ||
                      !!recordingUrl;
                    if (!hasMeetingMeta) return null;
                    return (
                      <div className="mt-2 space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs">

                        {startD && (
                          <div className="flex items-start gap-2">
                            <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <div>
                              <div className="font-medium text-foreground">
                                {formatDateTime(startD.toISOString())}
                                {endD && (
                                  <span className="text-muted-foreground">
                                    {sameDay
                                      ? ` – ${timeFmt(endD)}`
                                      : ` – ${formatDateTime(endD.toISOString())}`}
                                  </span>
                                )}
                              </div>
                              {endD && (
                                <div className="text-[11px] text-muted-foreground">
                                  Duração:{" "}
                                  {Math.max(
                                    1,
                                    Math.round((endD.getTime() - startD.getTime()) / 60000),
                                  )}{" "}
                                  min
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {(joinLink || loc) && (
                          <div className="flex items-start gap-2">
                            <LinkIcon className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              {joinLink ? (
                                <a
                                  href={joinLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline break-all"
                                >
                                  {joinLink}
                                </a>
                              ) : (
                                <span className="break-all">{loc}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {meta.attendees && meta.attendees.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Users className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {meta.attendees.map((p, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                  {p.contact_id ? (
                                    <User className="h-2.5 w-2.5" />
                                  ) : (
                                    <Mail className="h-2.5 w-2.5" />
                                  )}
                                  {p.name ? `${p.name} <${p.email}>` : p.email}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {(accessLink || recordingUrl) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {accessLink && (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                              >
                                <a href={accessLink} target="_blank" rel="noreferrer">
                                  Acessar reunião
                                </a>
                              </Button>
                            )}
                            {recordingUrl && (
                              <>
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                >
                                  <a href={recordingUrl} target="_blank" rel="noreferrer">
                                    Ver gravação
                                  </a>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => onSummarizeMeeting?.(a.id)}
                                >
                                  Resumir reunião
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {editingId === a.id ? (
                    <div className="mt-2 space-y-2">
                      <RichHtmlEditor
                        value={editingBody}
                        onChange={setEditingBody}
                        minHeight={120}
                        mentions={team}
                      />
                      {a.type === "task" && (
                        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Responsável
                            </label>
                            <Select
                              value={editingAssigneeId ?? ""}
                              onValueChange={(v) => setEditingAssigneeId(v || null)}
                            >
                              <SelectTrigger className="h-9 text-xs w-full">
                                <SelectValue placeholder="Selecionar responsável" />
                              </SelectTrigger>
                              <SelectContent>
                                {team.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Data de vencimento
                            </label>
                            <div className="flex items-center gap-1.5">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "h-9 text-xs justify-start font-normal flex-1 min-w-0",
                                      !editingDueDate && "text-muted-foreground",
                                    )}
                                  >
                                    <CalendarDays className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                    <span className="truncate">
                                      {editingDueDate
                                        ? formatDateTime(editingDueDate)
                                        : "Definir vencimento"}
                                    </span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-auto p-0"
                                  align="end"
                                  sideOffset={8}
                                >
                                  <Calendar
                                    mode="single"
                                    selected={editingDueDate ? new Date(editingDueDate) : undefined}
                                    onSelect={(d) => {
                                      if (!d) return;
                                      const base = editingDueDate
                                        ? new Date(editingDueDate)
                                        : new Date();
                                      d.setHours(base.getHours(), base.getMinutes(), 0, 0);
                                      setEditingDueDate(d.toISOString());
                                    }}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                              {editingDueDate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditingDueDate(null)}
                                  aria-label="Limpar data"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(Object.keys(TASK_DUE_PRESET_LABELS) as TaskDuePreset[])
                                .filter((k) => k !== "custom")
                                .map((k) => (
                                  <Button
                                    key={k}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs px-2.5 rounded-full font-normal"
                                    onClick={() =>
                                      setEditingDueDate(computeDuePreset(k, editingDueDate))
                                    }
                                  >
                                    {TASK_DUE_PRESET_LABELS[k]}
                                  </Button>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {(editingAttachments.length > 0 || editingNewFiles.length > 0) && (
                        <div className="flex flex-wrap gap-2">
                          {editingAttachments.map((att, i) => (
                            <Badge key={`ex-${i}`} variant="secondary" className="gap-1">
                              <Paperclip className="h-3 w-3" /> {att.name}
                              <button
                                onClick={() =>
                                  setEditingAttachments((p) => p.filter((_, idx) => idx !== i))
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          {editingNewFiles.map((f, i) => (
                            <Badge key={`new-${i}`} variant="secondary" className="gap-1">
                              <Paperclip className="h-3 w-3" /> {f.name}
                              <button
                                onClick={() =>
                                  setEditingNewFiles((p) => p.filter((_, idx) => idx !== i))
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (files.length) setEditingNewFiles((p) => [...p, ...files]);
                              e.target.value = "";
                            }}
                          />
                          <Paperclip className="h-3 w-3" /> Anexar
                        </label>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(a)}>
                            <Check className="h-3 w-3 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : a.type === "email" && emailMeta.has(a.id) ? (
                    <EmailTimelineItem
                      meta={emailMeta.get(a.id)!}
                      createdAt={a.created_at ?? null}
                      onOpenAttachment={openEmailAttachment}
                    />
                  ) : (
                    a.body &&
                    !(a.type === "call" && /Tipo de Chamada\s*:/i.test(a.body)) && (
                      <HtmlContent html={a.body} className="text-sm text-foreground/90 mt-1" />
                    )
                  )}
                  {a.type === "call" && a.body && /Tipo de Chamada\s*:/i.test(a.body) && (() => {
                    const text = a.body.replace(/<[^>]+>/g, "\n");
                    const pick = (re: RegExp) => {
                      const m = text.match(re);
                      return m?.[1]?.trim() ?? null;
                    };
                    const direction = pick(/Tipo de Chamada\s*:\s*([A-Z]+)/i);
                    const from = pick(/De\s*:\s*([+\d\s()-]+?)(?:\s+para|$)/i);
                    const to = pick(/para\s+([+\d\s()-]+)/i);
                    const status = pick(/Status\s*:\s*([A-Z_]+)/i);
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {direction && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {direction.toLowerCase() === "outbound" ? "Saída" : direction.toLowerCase() === "inbound" ? "Entrada" : direction.toLowerCase()}
                          </Badge>
                        )}
                        {from && to && (
                          <span className="text-muted-foreground tabular-nums">
                            {from} → {to}
                          </span>
                        )}
                        {status && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {status.toLowerCase().replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  {a.type === "call" && (a.duration_ms || a.disposition) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {a.disposition && (
                        <Badge variant="secondary" className="text-[10px]">
                          {a.disposition}
                        </Badge>
                      )}
                      {a.duration_ms != null && a.duration_ms > 0 && (
                        <span className="text-muted-foreground">
                          {Math.floor(a.duration_ms / 60000)}m{" "}
                          {Math.floor((a.duration_ms % 60000) / 1000)}s
                        </span>
                      )}
                    </div>
                  )}
                  {a.type === "call" && (() => {
                    const url =
                      a.recording_url ||
                      (a.body?.match(/https?:\/\/[^\s<"']+\.(?:mp3|wav|ogg|m4a)/i)?.[0] ?? null) ||
                      (a.body?.match(/https?:\/\/api\.twilio\.com\/[^\s<"']+/i)?.[0] ?? null);
                    if (!url) return null;
                    return (
                      <div className="mt-3 space-y-1">
                        <audio controls preload="none" src={url} className="w-full h-10" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" /> Abrir gravação
                        </a>
                      </div>
                    );
                  })()}


                  {a.type === "email" && !emailMeta.has(a.id) && (a.email_direction || a.email_status) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {a.email_direction && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {a.email_direction === "inbound"
                            ? "recebido"
                            : a.email_direction === "outbound"
                              ? "enviado"
                              : a.email_direction}
                        </Badge>
                      )}
                      {a.email_status && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {a.email_status}
                        </Badge>
                      )}
                    </div>
                  )}
                  {/* Mentions render inline within the body HTML; no duplicate chip below. */}
                  {editingId !== a.id && atts.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {atts.map((att, i) => (
                        <AttachmentPreview
                          key={i}
                          attachment={att}
                          signRecording={async (path) => {
                            const { url } = await signMeetingRec({ data: { path } });
                            return url;
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {(() => {
                    const ext = ((a as unknown as { external_ids?: Record<string, unknown> }).external_ids ?? {}) as Record<string, unknown>;
                    const src = typeof ext.source === "string" ? (ext.source as string) : null;
                    const isCalSynced = a.id.startsWith("cal_");
                    const callKeys = ["twilio_call_sid", "vapi_call_id", "twilio_sid"];
                    const hasGcal = Object.keys(ext).some((k) => k.startsWith("gcal_"));
                    const isExternal =
                      isCalSynced ||
                      hasGcal ||
                      src === "google_calendar" ||
                      src === "meeting_recording" ||
                      src === "meeting_action_item" ||
                      src === "call" ||
                      callKeys.some((k) => ext[k]);
                    if (isExternal) {
                      return (
                        <div className="flex gap-1 mt-3 pt-3 border-t border-border/60">
                          <span className="text-[11px] text-muted-foreground italic px-2 py-1">
                            {isCalSynced || hasGcal || src === "google_calendar"
                              ? "Evento sincronizado do Google Calendar — edite na origem."
                              : "Atividade sincronizada — edite na origem."}
                          </span>
                        </div>
                      );
                    }
                    if (editingId === a.id) return null;

                    return (
                      <div className="flex gap-1 mt-3 pt-3 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => (editingId === a.id ? setEditingId(null) : startEdit(a))}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => remove(a.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>
                      </div>
                    );
                  })()}

                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
