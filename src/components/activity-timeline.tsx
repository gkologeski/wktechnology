import { useEffect, useState } from "react";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { signMeetingRecording } from "@/lib/meetings.functions";
import type { WhatsAppIdentity } from "@/lib/whatsapp-paste";
import { useHasMessageDraft } from "@/hooks/use-has-message-draft";
import {
  type BarAction,
  ACTIONS_BY_KEY,
  type RelatedKey,
  type TeamMember,
} from "./activity/timeline-shared";
import { TimelineActionBar } from "./activity/timeline-action-bar";
import { TimelineEntriesList } from "./activity/timeline-entries-list";
import { fetchTimelineTarget, fetchTimelineTeam } from "@/lib/timeline/activity-entities";
import { TimelineRail } from "./activity/timeline-rail";
import { useTimelineFeed } from "./activity/use-timeline-feed";
import {
  removeActivity,
  toggleActivityDone,
  updateActivity,
} from "@/lib/timeline/activity-mutations";
import { InstantRoomButton } from "./activity/instant-room-button";
import { useActivityEditing } from "./activity/use-activity-editing";
import { useMeetingSummary } from "./activity/use-meeting-summary";
import { useActivityWindows } from "./activity/activity-window-context";

export function ActivityTimeline({
  relatedKey,
  relatedId,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
}) {
  const { user } = useAuth();
  const {
    items,
    emailMeta,
    surveyMeta,
    loading,
    refreshing,
    load,
    showHistory,
    setShowHistory,
    datePreset,
    setDatePreset,
    dateCustom,
    setDateCustom,
    timelineEntries,
    resolveHistoryValue,
    resolveHistoryActor,
  } = useTimelineFeed(relatedKey, relatedId);

  const openWindow = useActivityWindows();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [whatsappIdentity, setWhatsappIdentity] = useState<WhatsAppIdentity>({});
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const editing = useActivityEditing(user?.id, whatsappIdentity, () => afterChange());
  const [target, setTarget] = useState<{
    email?: string;
    phone?: string;
    contactId?: string;
    name?: string;
  }>({});

  // Pin de rascunho no ícone de e-mail da barra de ações.
  const hasEmailDraft = useHasMessageDraft({
    scope: {
      channel: "email",
      contactId: target.contactId,
      leadId: relatedKey === "related_lead_id" ? relatedId : undefined,
      dealId: relatedKey === "related_deal_id" ? relatedId : undefined,
      companyId: relatedKey === "related_company_id" ? relatedId : undefined,
      to: target.email ?? "",
    },
  });

  // Pin de rascunho no ícone de WhatsApp da barra de ações.
  const hasWhatsAppDraft = useHasMessageDraft({
    scope: { channel: "whatsapp", contactId: target.contactId, to: target.phone ?? "" },
  });

  // Resolve email/phone/contact from parent entity for the "Criar" actions
  useEffect(() => {
    void fetchTimelineTarget(relatedKey, relatedId).then((t) => {
      if (t) setTarget(t);
    });
  }, [relatedKey, relatedId]);

  // Load workspace members for @mentions and task assignment
  useEffect(() => {
    if (!user) return;
    void fetchTimelineTeam(user).then(({ team: list, workspaceId, whatsappIdentity: identity }) => {
      setCurrentWorkspaceId(workspaceId);
      setTeam(list);
      setWhatsappIdentity(identity);
    });
  }, [user]);

  /** Recarrega a timeline e avisa os demais componentes da mudança. */
  const afterChange = () => {
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

  const toggleDone = async (a: Activity) => {
    const res = await toggleActivityDone(a);
    if (!res.ok) return toast.error(res.error);
    afterChange();
  };

  const remove = async (id: string) => {
    const res = await removeActivity(id);
    if (!res.ok) return toast.error(res.error);
    afterChange();
  };

  const signMeetingRec = useServerFn(signMeetingRecording);
  const onSummarizeMeeting = useMeetingSummary(items, () => void load());

  const handleBarClick = (action: BarAction) => {
    openWindow?.({ action, relatedKey, relatedId });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-md border border-border/60 overflow-hidden">
        <TimelineActionBar
          relatedKey={relatedKey}
          composerOpen={false}
          activeLogType="note"
          hasEmailDraft={hasEmailDraft}
          hasWhatsAppDraft={hasWhatsAppDraft}
          onAction={handleBarClick}
          trailing={
            <InstantRoomButton
              relatedKey={relatedKey}
              relatedId={relatedId}
              targetName={target.name}
              onCreated={() => void load()}
            />
          }
        />
      </div>

      {/* Timeline rail */}
      <TimelineRail
        relatedKey={relatedKey}
        relatedId={relatedId}
        datePreset={datePreset}
        dateCustom={dateCustom}
        onDateChange={(preset, custom) => {
          setDatePreset(preset);
          setDateCustom(custom);
        }}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory((v) => !v)}
        refreshing={refreshing && !loading}
      />

      <TimelineEntriesList
        onPatch={async (a, patch) => {
          const res = await updateActivity(a.id, patch);
          if (!res.ok) return toast.error(res.error);
          afterChange();
        }}
        onFollowUp={(a) => {
          const action = ACTIONS_BY_KEY["log:task"];
          if (action)
            openWindow?.({
              action,
              relatedKey,
              relatedId,
              subject: `Acompanhar: ${a.subject || "atividade"}`,
            });
        }}
        loading={loading}
        entries={timelineEntries}
        emailMeta={emailMeta}
        surveyMeta={surveyMeta}
        team={team}
        currentWorkspaceId={currentWorkspaceId}
        resolveHistoryValue={resolveHistoryValue}
        resolveHistoryActor={resolveHistoryActor}
        onToggleDone={(row) => void toggleDone(row)}
        onStartEdit={(activity) => openWindow?.({ action: ACTIONS_BY_KEY["log:task"], editingActivity: activity })}
        onRemove={(id) => void remove(id)}
        onSummarizeMeeting={(id) => void onSummarizeMeeting(id)}
        signRecording={async (path) => {
          const { url } = await signMeetingRec({ data: { path } });
          return url;
        }}
        editing={{
          id: editing.editingId,
          body: editing.body,
          onBodyChange: editing.setBody,
          assigneeId: editing.assigneeId,
          onAssigneeChange: editing.setAssigneeId,
          dueDate: editing.dueDate,
          onDueDateChange: editing.setDueDate,
          attachments: editing.attachments,
          onAttachmentsChange: editing.setAttachments,
          newFiles: editing.newFiles,
          onNewFilesChange: editing.setNewFiles,
          onOpenFileCenter: () => editing.setPickerOpen(true),
          onSave: (a) => void editing.saveEdit(a),
          onCancel: () => editing.setEditingId(null),
        }}
      />
    </div>
  );
}
