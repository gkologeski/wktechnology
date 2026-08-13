import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ActivityType } from "@/lib/crm";
import { toast } from "sonner";
import { StickyNote, ListTodo, Phone, Mail, CalendarDays, MessageSquare, MessageCircle, Linkedin, Inbox, ClipboardList, Workflow, FileText, FileSpreadsheet, Image as ImageIcon, Archive, File as FileIcon } from "lucide-react";

export type EmailMeta = {
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

export function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function openEmailAttachment(path: string | undefined) {
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

export const ICONS: Record<ActivityType, ReactNode> = {
  note: <StickyNote className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <CalendarDays className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  postal_mail: <Inbox className="h-4 w-4" />,
  linkedin_message: <Linkedin className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  survey: <ClipboardList className="h-4 w-4" />,
};

export type RelatedKey =
  | "related_lead_id"
  | "related_contact_id"
  | "related_company_id"
  | "related_deal_id"
  | "related_ticket_id";

export type Attachment = { path: string; name: string; size: number; type: string; bucket?: string };

export type TeamMember = { id: string; name: string };

export type CalendarAttendee = { email?: string; displayName?: string; organizer?: boolean; self?: boolean };

export function normalizeTimelineEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export type TaskDuePreset = "custom" | "today" | "tomorrow" | "next_week" | "next_month" | "in_3_months";

export const TASK_DUE_PRESET_LABELS: Record<TaskDuePreset, string> = {
  custom: "Personalizada",
  today: "Hoje",
  tomorrow: "Amanhã",
  next_week: "Semana que vem",
  next_month: "Mês que vem",
  in_3_months: "Daqui 3 meses",
};

export function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function computeDuePreset(preset: TaskDuePreset, baseIso: string | null): string | null {
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

export function emailDomain(email: string | null | undefined) {
  return normalizeTimelineEmail(email).split("@")[1] ?? "";
}

export function calendarAttendees(value: unknown): CalendarAttendee[] {
  return Array.isArray(value) ? (value as CalendarAttendee[]) : [];
}

export function calendarInternalDomains(attendees: CalendarAttendee[]) {
  const domains = new Set<string>();
  for (const attendee of attendees) {
    if (!attendee.email || (!attendee.self && !attendee.organizer)) continue;
    const domain = emailDomain(attendee.email);
    if (domain) domains.add(domain);
  }
  return domains;
}

export function calendarEventTargetsEmails(
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
export type LogKind = ActivityType;

export const LOG_LABEL: Record<LogKind, string> = {
  note: "Nota",
  task: "Tarefa",
  email: "Registrar e-mail",
  call: "Registrar chamada",
  meeting: "Registrar reunião",
  whatsapp: "Registrar WhatsApp",
  sms: "Registrar SMS",
  linkedin_message: "Registrar LinkedIn",
  postal_mail: "Registrar correio",
  survey: "Pesquisa",
};

export type CreateAction =
  | "meeting"
  | "email"
  | "call"
  | "whatsapp"
  | "sequence"
  | "linkedin"
  | "survey";

export type BarAction =
  | { kind: "log"; value: LogKind; label: string; icon: ReactNode }
  | { kind: "create"; value: CreateAction; label: string; icon: ReactNode; disabled?: boolean };

export const actionKey = (a: BarAction) => `${a.kind}:${a.value}`;

// Catálogo de todas as ações disponíveis
export const ALL_ACTIONS: BarAction[] = [
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
  {
    kind: "create",
    value: "survey",
    label: "Pesquisa",
    icon: <ClipboardList className="h-5 w-5" />,
  },
];

export const ACTIONS_BY_KEY: Record<string, BarAction> = Object.fromEntries(
  ALL_ACTIONS.map((a) => [actionKey(a), a]),
);

export const DEFAULT_PINNED = ALL_ACTIONS.slice(0, 5).map(actionKey);

export const DEFAULT_MORE = ALL_ACTIONS.slice(5).map(actionKey);

export const STORAGE_KEY = "activity-action-order-v1";

export type OrderState = { pinned: string[]; more: string[] };

export function loadOrder(): OrderState {
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

export function initialsFromEmail(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  if (!src) return "?";
  const parts = src.replace(/@.*$/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  const hue = h % 360;
  return `hsl(${hue} 55% 45%)`;
}

export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function attachmentIcon(filename: string, contentType?: string) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
  if (ct === "application/pdf" || ext === "pdf") return FileText;
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || ct.includes("spreadsheet") || ct.includes("excel")) return FileSpreadsheet;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || ct.includes("zip") || ct.includes("compressed")) return Archive;
  if (["doc", "docx", "txt", "rtf", "odt"].includes(ext) || ct.includes("word") || ct.startsWith("text/")) return FileText;
  return FileIcon;
}
