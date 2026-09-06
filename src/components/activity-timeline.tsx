import { useEffect, useState } from "react";
import { FileCenterPickerDialog } from "@/components/files/file-center-picker";
import { extractMentionIds } from "@/components/rich-html-editor";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import {
  signMeetingRecording,
  generateMeetingSummary,
  summarizeCalendarEventRecording,
} from "@/lib/meetings.functions";
import { notifyActivityEvent } from "@/lib/notifications.functions";
import { maybeConvertWhatsAppPaste } from "@/lib/whatsapp-paste";
import { useHasMessageDraft } from "@/hooks/use-has-message-draft";
import {
  type Attachment,
  type BarAction,
  type CreateAction,
  LOG_LABEL,
  type LogKind,
  type RelatedKey,
  type TeamMember,
} from "./activity/timeline-shared";
import { TimelineActionBar } from "./activity/timeline-action-bar";
import { HistoryTimelineItem } from "./activity/history-timeline-item";
import {
  fetchTimelineTarget,
  fetchTimelineTeam,
  resolveTimelineAutoLinks,
  uploadTimelineFiles,
} from "@/lib/timeline/activity-entities";
import { ActivityTimelineItem } from "./activity/activity-timeline-item";
import { ActivityEditForm } from "./activity/activity-edit-form";
import { TimelineComposer } from "./activity/timeline-composer";
import { TimelineActionDialogs } from "./activity/timeline-action-dialogs";
import { TimelineRail } from "./activity/timeline-rail";
import { useTimelineFeed } from "./activity/use-timeline-feed";
import {
  activityAttachments,
  insertActivity,
  removeActivity,
  toggleActivityDone,
  updateActivity,
} from "@/lib/timeline/activity-mutations";
import { InstantRoomButton } from "./activity/instant-room-button";


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

  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState<LogKind>("note");
  const [moreOpen, setMoreOpen] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindBefore, setRemindBefore] = useState("0");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
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
  // Mantém o discador montado após a primeira abertura (preserva chamada em
  // andamento ao fechar o modal), mas evita baixar o SDK de voz antes disso.
  const [dialerMounted, setDialerMounted] = useState(false);
  useEffect(() => {
    if (openAction === "call") setDialerMounted(true);
  }, [openAction]);

  // Contact info resolved from parent entity for action dialogs
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

  const [dateOpen, setDateOpen] = useState(false);

  // Resolve email/phone/contact from parent entity for the "Criar" actions
  useEffect(() => {
    void fetchTimelineTarget(relatedKey, relatedId).then((t) => {
      if (t) setTarget(t);
    });
  }, [relatedKey, relatedId]);

  // Load workspace members for @mentions and task assignment
  useEffect(() => {
    if (!user) return;
    void fetchTimelineTeam(user).then(({ team: list, workspaceId }) => {
      setCurrentWorkspaceId(workspaceId);
      setTeam(list);
    });
  }, [user]);

  const uploadFiles = async (): Promise<Attachment[]> =>
    !user || pendingFiles.length === 0 ? [] : uploadTimelineFiles(user.id, pendingFiles);

  const resolveAutoLinks = () => resolveTimelineAutoLinks(relatedKey, relatedId);

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
    const schedulable = type === "task" || type === "call" || type === "meeting";
    const payload: Record<string, unknown> = {
      owner_id: type === "task" && assigneeId ? assigneeId : user.id,
      created_by: user.id,
      type,
      subject: subject || (waHtml ? "Conversa de WhatsApp" : null),
      body: finalBody,
      due_date: schedulable && dueDate ? new Date(dueDate).toISOString() : null,
      remind_before_minutes:
        schedulable && dueDate && remindBefore !== "none" ? Number(remindBefore) : null,
      mentions: waHtml ? [] : extractMentionIds(body),
      attachments,
      ...autoLinks,
    };
    const res = await insertActivity(payload);
    if (!res.ok) return toast.error(res.error);
    if (res.insertedId) {
      void notifyActivityEventFn({ data: { activityId: res.insertedId } }).catch(() => {});
    }
    setSubject("");
    setBody("");
    setDueDate("");
    setRemindBefore("0");
    setAssigneeId("");
    setPendingFiles([]);
    setMentions([]);
    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

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

  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setEditingBody(a.body ?? "");
    setEditingAttachments(activityAttachments(a));
    setEditingNewFiles([]);
    setEditingAssigneeId(
      a.type === "task" ? ((a as unknown as { owner_id?: string | null }).owner_id ?? null) : null,
    );
    setEditingDueDate(a.type === "task" ? (a.due_date ?? null) : null);
  };

  const uploadEditingFiles = async (): Promise<Attachment[]> =>
    !user || editingNewFiles.length === 0 ? [] : uploadTimelineFiles(user.id, editingNewFiles);

  const saveEdit = async (a: Activity) => {
    const uploaded = await uploadEditingFiles();
    const patch: Record<string, unknown> = {
      body: editingBody || null,
      attachments: [...editingAttachments, ...uploaded],
    };
    if (a.type === "task") {
      patch.owner_id = editingAssigneeId ?? user?.id ?? null;
      patch.due_date = editingDueDate ? new Date(editingDueDate).toISOString() : null;
    }
    const res = await updateActivity(a.id, patch);
    if (!res.ok) return toast.error(res.error);
    setEditingId(null);
    setEditingAttachments([]);
    setEditingNewFiles([]);
    setEditingAssigneeId(null);
    setEditingDueDate(null);
    afterChange();
  };

  const signMeetingRec = useServerFn(signMeetingRecording);
  const summarizeMeetingFn = useServerFn(generateMeetingSummary);
  const summarizeCalEventFn = useServerFn(summarizeCalendarEventRecording);
  const onSummarizeMeeting = async (activityId: string) => {
    const a = items.find((i) => i.id === activityId);
    const ext = ((a as unknown as { external_ids?: Record<string, unknown> } | undefined)
      ?.external_ids ?? {}) as Record<string, unknown>;
    const meetingId = typeof ext.meeting_id === "string" ? (ext.meeting_id as string) : null;
    const calendarEventId =
      typeof ext.calendar_event_id === "string" ? (ext.calendar_event_id as string) : null;
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
  };

  const pickCreate = (action: CreateAction) => {
    setOpenAction(action);
  };

  const handleBarClick = (a: BarAction) => {
    if (a.kind === "log") pickLog(a.value);
    else pickCreate(a.value);
  };

  const currentLogLabel = LOG_LABEL[type] ?? "Atividade";

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
        <TimelineActionBar
          relatedKey={relatedKey}
          composerOpen={composerOpen}
          activeLogType={type}
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

        {/* Inline composer (only when a "log" action is selected) */}
        {composerOpen && (
          <TimelineComposer
            type={type}
            label={currentLogLabel}
            currentUserId={user?.id}
            team={team}
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            onMentionAdd={(m) => {
              if (!mentions.find((x) => x.id === m.id)) setMentions((prev) => [...prev, m]);
            }}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            remindBefore={remindBefore}
            onRemindBeforeChange={setRemindBefore}
            assigneeId={assigneeId}
            onAssigneeChange={setAssigneeId}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            onOpenFileCenter={() => setPickerOpen(true)}
            onClose={() => {
              setComposerOpen(false);
              setSubject("");
              setBody("");
              setDueDate("");
              setRemindBefore("0");
              setPendingFiles([]);
            }}
            onSave={() => {
              void add().then(() => setComposerOpen(false));
            }}
          />
        )}
      </div>

      <FileCenterPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPicked={(files) => setPendingFiles((p) => [...p, ...files])}
      />
      <FileCenterPickerDialog
        open={editPickerOpen}
        onOpenChange={setEditPickerOpen}
        onPicked={(files) => setEditingNewFiles((p) => [...p, ...files])}
      />

      {/* Action dialogs */}
      <TimelineActionDialogs
        openAction={openAction}
        onClose={() => setOpenAction(null)}
        relatedKey={relatedKey}
        relatedId={relatedId}
        target={target}
        dialerMounted={dialerMounted}
        onRefresh={() => void load()}
      />

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

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : timelineEntries.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhuma atividade ainda.
        </div>
      ) : (
        <ol className="space-y-5">
          {timelineEntries.map((entry) => {
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
                isEditing={editingId === a.id}
                onToggleDone={(row) => void toggleDone(row)}
                onStartEdit={startEdit}
                onRemove={(id) => void remove(id)}
                onSummarizeMeeting={(id) => void onSummarizeMeeting(id)}
                signRecording={async (path) => {
                  const { url } = await signMeetingRec({ data: { path } });
                  return url;
                }}
                editForm={
                  <ActivityEditForm
                    activity={a}
                    team={team}
                    body={editingBody}
                    onBodyChange={setEditingBody}
                    assigneeId={editingAssigneeId}
                    onAssigneeChange={setEditingAssigneeId}
                    dueDate={editingDueDate}
                    onDueDateChange={setEditingDueDate}
                    attachments={editingAttachments}
                    onAttachmentsChange={setEditingAttachments}
                    newFiles={editingNewFiles}
                    onNewFilesChange={setEditingNewFiles}
                    onOpenFileCenter={() => setEditPickerOpen(true)}
                    onSave={() => void saveEdit(a)}
                    onCancel={() => setEditingId(null)}
                  />
                }
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
