// Lista cronológica da timeline: atividades e grupos de histórico, incluindo o
// formulário de edição inline da atividade em edição.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import type { Activity } from "@/lib/db-types";
import type { Attachment, EmailMeta, TeamMember } from "@/components/activity/timeline-shared";
import type { SurveyResponseSummary } from "@/components/surveys/survey-timeline-card";
import type { TimelineEntry } from "@/components/activity/use-timeline-feed";
import { ActivityTimelineItem } from "@/components/activity/activity-timeline-item";
import { ActivityEditForm } from "@/components/activity/activity-edit-form";
import { HistoryTimelineItem } from "@/components/activity/history-timeline-item";

export type TimelineEditingState = {
  id: string | null;
  body: string;
  onBodyChange: (v: string) => void;
  assigneeId: string | null;
  onAssigneeChange: (v: string | null) => void;
  dueDate: string | null;
  onDueDateChange: (v: string | null) => void;
  attachments: Attachment[];
  onAttachmentsChange: (updater: (prev: Attachment[]) => Attachment[]) => void;
  newFiles: File[];
  onNewFilesChange: (updater: (prev: File[]) => File[]) => void;
  onOpenFileCenter: () => void;
  onSave: (a: Activity) => void;
  onCancel: () => void;
};

export function TimelineEntriesList({
  loading,
  entries,
  emailMeta,
  surveyMeta,
  team,
  currentWorkspaceId,
  resolveHistoryValue,
  resolveHistoryActor,
  onToggleDone,
  onStartEdit,
  onRemove,
  onSummarizeMeeting,
  signRecording,
  editing,
}: {
  loading: boolean;
  entries: TimelineEntry[];
  emailMeta: Map<string, EmailMeta>;
  surveyMeta: Map<string, SurveyResponseSummary>;
  team: TeamMember[];
  currentWorkspaceId: string | null;
  resolveHistoryValue: (property: string, value: unknown) => string | null;
  resolveHistoryActor: (id: string | null) => string;
  onToggleDone: (a: Activity) => void;
  onStartEdit: (a: Activity) => void;
  onRemove: (id: string) => void;
  onSummarizeMeeting: (id: string) => void;
  signRecording: (path: string) => Promise<string>;
  editing: TimelineEditingState;
}) {
  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</div>
    );
  }

  return (
    <ol className="space-y-5">
      {entries.map((entry) => {
        if (entry.history) {
          return (
            <HistoryTimelineItem
              key={entry.history.id}
              group={entry.history}
              resolveValue={resolveHistoryValue}
              resolveActor={resolveHistoryActor}
            />
          );
        }
        const a = entry.activity as Activity;
        return (
          <ActivityTimelineItem
            key={a.id}
            activity={a}
            emailMeta={emailMeta.get(a.id)}
            surveyResponse={surveyMeta.get(a.id)}
            team={team}
            currentWorkspaceId={currentWorkspaceId}
            isEditing={editing.id === a.id}
            onToggleDone={onToggleDone}
            onStartEdit={onStartEdit}
            onRemove={onRemove}
            onSummarizeMeeting={onSummarizeMeeting}
            signRecording={signRecording}
            editForm={
              <ActivityEditForm
                activity={a}
                team={team}
                body={editing.body}
                onBodyChange={editing.onBodyChange}
                assigneeId={editing.assigneeId}
                onAssigneeChange={editing.onAssigneeChange}
                dueDate={editing.dueDate}
                onDueDateChange={editing.onDueDateChange}
                attachments={editing.attachments}
                onAttachmentsChange={editing.onAttachmentsChange}
                newFiles={editing.newFiles}
                onNewFilesChange={editing.onNewFilesChange}
                onOpenFileCenter={editing.onOpenFileCenter}
                onSave={() => editing.onSave(a)}
                onCancel={editing.onCancel}
              />
            }
          />
        );
      })}
    </ol>
  );
}
