// Card de uma atividade na timeline: cabeçalho, blocos por tipo (pesquisa,
// reunião, e-mail, chamada), edição inline, anexos, ações e comentários.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import type { ReactNode } from "react";
import { Pencil, Send } from "lucide-react";
import {
  ActivityActionsMenu,
  PinnedMark,
  TaskFieldsGrid,
} from "@/components/activity/activity-card-controls";
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
  EmailStatusBadges,
  isStructuredCallBody,
} from "@/components/activity/call-meta";
import {
  SurveyTimelineCard,
  type SurveyResponseSummary,
} from "@/components/surveys/survey-timeline-card";
import { modernizeLegacyWhatsAppHtml } from "@/lib/whatsapp-paste";

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
  onPatch,
  onFollowUp,
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
  onPatch: (a: Activity, patch: Record<string, unknown>) => void;
  onFollowUp: (a: Activity) => void;
}) {
  const atts = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
  const icon = ICONS[a.type as ActivityType] ?? <Send className="h-4 w-4" />;
  const notice = externalNotice(a);
  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === a.type)?.label ?? "Atividade";
  const actorId =
    a.type === "task"
      ? ((a as { assigned_to?: string | null }).assigned_to ?? a.owner_id)
      : ((a as { created_by?: string | null }).created_by ?? a.owner_id);
  const actor = team.find((m) => m.id === actorId)?.name;
  const when = (a as { activity_date?: string | null }).activity_date ?? a.hs_createdate ?? a.created_at;
  const contacted = (a as { contacted_contact_ids?: string[] | null }).contacted_contact_ids ?? [];
  const assocCount = [
    a.related_contact_id,
    a.related_company_id,
    a.related_deal_id,
    a.related_lead_id,
    (a as { related_ticket_id?: string | null }).related_ticket_id,
  ].filter(Boolean).length;

  return (
    <li className="relative pl-10" id={`activity-${a.id}`}>
      <div className="absolute left-[11px] top-8 bottom-[-1.25rem] w-[2px] bg-border/60 last:hidden" />
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center text-primary z-10">
        {icon}
      </div>
      <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
            <PinnedMark activity={a} />
            <span className="font-semibold text-foreground">{typeLabel}</span>
            {actor && (
              <span className="truncate">
                {a.type === "task" ? "atribuída a" : "por"} {actor}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <ActivityActionsMenu
              activity={a}
              canEdit={!notice}
              onEdit={() => onStartEdit(a)}
              onRemove={() => onRemove(a.id)}
              onPatch={(p) => onPatch(a, p)}
              onFollowUp={() => onFollowUp(a)}
            />
            <span className="text-xs text-muted-foreground">{formatDateTime(when)}</span>
          </div>
        </div>
        <div className="flex justify-between items-start gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {a.type === "task" && (
              <Checkbox
                checked={a.completed}
                onCheckedChange={() => onToggleDone(a)}
                aria-label="Marcar como concluída"
              />
            )}
            <h4
              className={`text-sm font-semibold text-foreground truncate ${a.completed ? "line-through text-muted-foreground" : ""}`}
            >
              {a.subject || typeLabel}
            </h4>
          </div>
          {a.due_date &&
            a.type !== "meeting" &&
            a.type !== "task" &&
            (() => {
              const isOverdue = !a.completed && new Date(a.due_date).getTime() < Date.now();
              return (
                <span
                  className={`text-xs whitespace-nowrap ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
                >
                  Vence {formatDateTime(a.due_date)}
                </span>
              );
            })()}
        </div>
        {contacted.length > 0 && a.type !== "task" && (
          <div className="text-xs text-muted-foreground mb-1">
            Contatado: {contacted.length} {contacted.length === 1 ? "contato" : "contatos"}
          </div>
        )}
        {a.type === "task" && !isEditing && (
          <TaskFieldsGrid
            activity={a}
            team={team}
            disabled={!!notice}
            onPatch={(p) => onPatch(a, p)}
          />
        )}

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
            <HtmlContent
              html={modernizeLegacyWhatsAppHtml(a.body)}
              className="text-sm text-foreground/90 mt-1"
            />
          )
        )}

        <CallSummaryBadges activity={a} />
        <CallDurationBadges activity={a} />
        <CallRecordingPlayer activity={a} />
        {a.type === "email" && !emailMeta && <EmailStatusBadges activity={a} />}

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
          <div className="flex items-center justify-between gap-1 mt-3 pt-3 border-t border-border/60">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => onStartEdit(a)}
              >
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            </div>
            <span className="text-xs font-semibold text-foreground">
              {assocCount} {assocCount === 1 ? "associação" : "associações"}
            </span>
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
