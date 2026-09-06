// Card de uma atividade na timeline: cabeçalho, blocos por tipo (pesquisa,
// reunião, e-mail, chamada), edição inline, anexos, ações e comentários.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import type { ReactNode } from "react";
import { Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HtmlContent } from "@/components/rich-html-editor";
import { AttachmentPreview } from "@/components/timeline/attachment-preview";
import { ActivityComments } from "@/components/timeline/activity-comments";
import { ACTIVITY_TYPES, formatDateTime, type ActivityType } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import {
  type Attachment,
  type EmailMeta,
  ICONS,
  openEmailAttachment,
  type TeamMember,
} from "@/components/activity/timeline-shared";
import { EmailTimelineItem } from "@/components/activity/email-timeline-item";
import { MeetingMetaCard } from "@/components/activity/meeting-meta-card";
import {
  CallDurationBadges,
  CallRecordingPlayer,
  CallSummaryBadges,
  isStructuredCallBody,
} from "@/components/activity/call-meta";
import {
  SurveyTimelineCard,
  type SurveyResponseSummary,
} from "@/components/surveys/survey-timeline-card";

/** Atividades vindas de integrações não podem ser editadas na timeline. */
function externalNotice(a: Activity): string | null {
  const ext = ((a as unknown as { external_ids?: Record<string, unknown> }).external_ids ??
    {}) as Record<string, unknown>;
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
  if (!isExternal) return null;
  return isCalSynced || hasGcal || src === "google_calendar"
    ? "Evento sincronizado do Google Calendar — edite na origem."
    : "Atividade sincronizada — edite na origem.";
}

export function ActivityTimelineItem({
  activity: a,
  emailMeta,
  surveyResponse,
  team,
  currentWorkspaceId,
  isEditing,
  editForm,
  onToggleDone,
  onStartEdit,
  onRemove,
  onSummarizeMeeting,
  signRecording,
}: {
  activity: Activity;
  emailMeta: EmailMeta | undefined;
  surveyResponse: SurveyResponseSummary | undefined;
  team: TeamMember[];
  currentWorkspaceId: string | null;
  isEditing: boolean;
  /** Formulário de edição inline, montado pelo componente pai. */
  editForm: ReactNode;
  onToggleDone: (a: Activity) => void;
  onStartEdit: (a: Activity) => void;
  onRemove: (id: string) => void;
  onSummarizeMeeting: (activityId: string) => void;
  signRecording: (path: string) => Promise<string>;
}) {
  const atts = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
  const icon = ICONS[a.type as ActivityType] ?? <Send className="h-4 w-4" />;
  const notice = externalNotice(a);

  return (
    <li className="relative pl-10">
      <div className="absolute left-[11px] top-8 bottom-[-1.25rem] w-[2px] bg-border/60 last:hidden" />
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center text-primary z-10">
        {icon}
      </div>
      <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
        <div className="flex justify-between items-start gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {a.type === "task" && (
              <Checkbox checked={a.completed} onCheckedChange={() => onToggleDone(a)} />
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
            {a.due_date &&
              a.type !== "meeting" &&
              (() => {
                const isOverdue = !a.completed && new Date(a.due_date).getTime() < Date.now();
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

        {a.type === "survey" && surveyResponse && <SurveyTimelineCard response={surveyResponse} />}
        {a.type === "meeting" && <MeetingMetaCard activity={a} onSummarize={onSummarizeMeeting} />}

        {isEditing ? (
          editForm
        ) : a.type === "email" && emailMeta ? (
          <EmailTimelineItem
            meta={emailMeta}
            createdAt={a.created_at ?? null}
            onOpenAttachment={openEmailAttachment}
          />
        ) : (
          a.body &&
          !isStructuredCallBody(a) && (
            <HtmlContent html={a.body} className="text-sm text-foreground/90 mt-1" />
          )
        )}

        <CallSummaryBadges activity={a} />
        <CallDurationBadges activity={a} />
        <CallRecordingPlayer activity={a} />
        {a.type === "email" && !emailMeta && (
          <>
            {(a.email_direction || a.email_status) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {a.email_direction && (
                  <span className="rounded border px-1.5 py-0.5 text-[10px] capitalize">
                    {a.email_direction === "inbound"
                      ? "recebido"
                      : a.email_direction === "outbound"
                        ? "enviado"
                        : a.email_direction}
                  </span>
                )}
                {a.email_status && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] capitalize text-secondary-foreground">
                    {a.email_status}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Mentions render inline within the body HTML; no duplicate chip below. */}
        {!isEditing && atts.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {atts.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} signRecording={signRecording} />
            ))}
          </div>
        )}

        {notice ? (
          <div className="flex gap-1 mt-3 pt-3 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground italic px-2 py-1">{notice}</span>
          </div>
        ) : isEditing ? null : (
          <div className="flex gap-1 mt-3 pt-3 border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onStartEdit(a)}
            >
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(a.id)}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Excluir
            </Button>
          </div>
        )}

        <ActivityComments
          activityId={a.id}
          workspaceId={
            (a as unknown as { workspace_id?: string }).workspace_id ?? currentWorkspaceId
          }
          team={team}
        />
      </div>
    </li>
  );
}
