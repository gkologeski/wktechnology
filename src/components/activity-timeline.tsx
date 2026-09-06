import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { REMINDER_OPTIONS } from "@/lib/activity-reminders";
import { FileCenterPickerDialog } from "@/components/files/file-center-picker";
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
import { useServerFn } from "@tanstack/react-start";
import {
  signMeetingRecording,
  generateMeetingSummary,
  summarizeCalendarEventRecording,
} from "@/lib/meetings.functions";
import { notifyActivityEvent } from "@/lib/notifications.functions";
import { AttachmentPreview } from "@/components/timeline/attachment-preview";
import { ActivityComments } from "@/components/timeline/activity-comments";
import { maybeConvertWhatsAppPaste } from "@/lib/whatsapp-paste";
import {
  Mail,
  CalendarDays,
  Trash2,
  Paperclip,
  X,
  Pencil,
  Check,
  Send,
  Sparkles,
  Link as LinkIcon,
  Users,
  User,
  Video,
  Zap,
  FolderOpen,
  History,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarRange, Filter, Loader2 } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import {
  DATE_PRESET_LABELS,
  getDateRange,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { useHasMessageDraft } from "@/hooks/use-has-message-draft";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { StartVideoButton } from "@/components/meetings/start-video-button";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { deleteRowGuarded } from "@/lib/delete-guard";
import {
  type Attachment,
  type BarAction,
  type CreateAction,
  type EmailMeta,
  ICONS,
  LOG_LABEL,
  type LogKind,
  type RelatedKey,
  TASK_DUE_PRESET_LABELS,
  type TaskDuePreset,
  type TeamMember,
  calendarAttendees,
  computeDuePreset,
  openEmailAttachment,
} from "./activity/timeline-shared";
import { TimelineActionBar } from "./activity/timeline-action-bar";

import { EmailTimelineItem } from "./activity/email-timeline-item";
import { HistoryTimelineItem } from "./activity/history-timeline-item";
import { useHistoryLabels } from "./activity/use-history-labels";
import {
  groupPropertyChanges,
  type HistoryGroup,
  type PropertyChangeRow,
} from "@/lib/timeline/history-groups";
import { SurveyActivityDialog } from "@/components/surveys/survey-activity-dialog";
import {
  SurveyTimelineCard,
  type SurveyResponseSummary,
} from "@/components/surveys/survey-timeline-card";
import { getActivitySurveyResponses } from "@/lib/surveys/survey-activity.functions";
import { fetchTimelineData } from "@/lib/timeline/activity-fetch";
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

// O discador carrega o SDK de voz da Twilio; só baixamos esse código quando o
// usuário abre a ação de ligação pela primeira vez.
const CallDialer = lazy(() =>
  import("@/components/voice/call-dialer").then((m) => ({ default: m.CallDialer })),
);

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

  // Histórico de alterações/movimentações (property_history) exibido na timeline.
  const [historyRows, setHistoryRows] = useState<PropertyChangeRow[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Filtro de período da timeline (presets + datas customizadas)
  const [datePreset, setDatePreset] = useState<DatePreset>("any");
  const [dateCustom, setDateCustom] = useState<CustomRange>({});
  const [dateOpen, setDateOpen] = useState(false);

  const load = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    const data = await fetchTimelineData({ relatedKey, relatedId, datePreset, dateCustom });
    if (data.error) toast.error(data.error);
    setEmailMeta(data.emailMeta);
    setItems(data.items);
    setHistoryRows(data.historyRows);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [relatedId, datePreset, dateCustom.start, dateCustom.end]);

  // Histórico agrupado + resolução de IDs para nomes.
  const historyGroups = useMemo(() => groupPropertyChanges(historyRows), [historyRows]);
  const { resolveValue: resolveHistoryValue, resolveActor: resolveHistoryActor } =
    useHistoryLabels(historyRows);

  // Lista única, cronológica, de atividades + eventos de histórico.
  const timelineEntries = useMemo(() => {
    const entries: Array<{ t: number; activity?: Activity; history?: HistoryGroup }> = items.map(
      (a) => ({
        t: new Date(a.hs_createdate ?? a.created_at ?? 0).getTime(),
        activity: a,
      }),
    );
    if (showHistory) {
      for (const g of historyGroups) {
        entries.push({ t: new Date(g.changed_at).getTime(), history: g });
      }
    }
    return entries.sort((a, b) => b.t - a.t);
  }, [items, historyGroups, showHistory]);

  // Carrega as respostas das atividades do tipo "pesquisa" exibidas na timeline.
  useEffect(() => {
    const ids = items.filter((a) => a.type === "survey").map((a) => a.id);
    if (ids.length === 0) {
      setSurveyMeta((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    void getActivitySurveyResponses({ data: { activity_ids: ids } })
      .then((rows) => {
        if (cancelled) return;
        setSurveyMeta(
          new Map((rows as SurveyResponseSummary[]).map((r) => [r.activity_id, r] as const)),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [items, surveyTick]);

  // Re-sincroniza silenciosamente quando a janela volta a focar ou um modal fecha
  useRefreshCallback(() => {
    void load({ silent: true });
  });

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

  // Realtime: atualiza a timeline assim que uma atividade (ou resposta de
  // pesquisa) deste registro é criada/alterada/removida — inclusive quando a
  // gravação acontece no servidor após o modal fechar, ou por outro usuário.
  useEffect(() => {
    if (typeof window === "undefined" || !relatedId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (fn: () => void) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 250);
    };

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(`timeline:${relatedKey}:${relatedId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "activities",
            filter: `${relatedKey}=eq.${relatedId}`,
          },
          () => schedule(() => void load({ silent: true })),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activity_survey_responses" },
          () => schedule(() => setSurveyTick((t) => t + 1)),
        )
        .subscribe();
    };

    const unsubscribe = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) unsubscribe();
      else {
        subscribe();
        void load({ silent: true });
      }
    };

    if (!document.hidden) subscribe();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedKey, relatedId, datePreset, dateCustom.start, dateCustom.end]);

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
    setRemindBefore("0");
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
    const res = await deleteRowGuarded("activities", id);
    if (!res.ok) return toast.error(res.message);

    void load();
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };

  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setEditingBody(a.body ?? "");
    const existing = (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
    setEditingAttachments(existing);
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
          trailing={(() => {
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
