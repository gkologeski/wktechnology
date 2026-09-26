import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { notifyActivityEvent } from "@/lib/notifications.functions";
import { extractMentionIds } from "@/components/rich-html-editor";
import { FileCenterPickerDialog } from "@/components/files/file-center-picker";
import { maybeConvertWhatsAppPaste, type WhatsAppIdentity } from "@/lib/whatsapp-paste";
import { fetchTimelineTarget, fetchTimelineTeam, resolveTimelineAutoLinks, uploadTimelineFiles } from "@/lib/timeline/activity-entities";
import { insertActivity } from "@/lib/timeline/activity-mutations";
import { followUpDate } from "@/lib/activity-task-options";
import { DEFAULT_FOLLOW_UP } from "./follow-up-task-control";
import { nowLocalInput, type ComposerExtrasState } from "./timeline-composer-extras";
import { TimelineComposer } from "./timeline-composer";
import { LOG_LABEL, type Attachment, type LogKind, type TeamMember } from "./timeline-shared";
import type { ActivityWindowRequest } from "./activity-window-context";

function freshExtras(): ComposerExtrasState { return { contactedIds: [], activityDate: nowLocalInput(), taskType: "todo", priority: "none", status: "not_started", recurrence: null, followUp: DEFAULT_FOLLOW_UP }; }

export function ActivityLogWindow({ request, onSaved }: { request: ActivityWindowRequest; onSaved: () => void }) {
  const { user } = useAuth();
  const type: LogKind = request.action.kind === "log" ? request.action.value : "note";
  const label = LOG_LABEL[type] ?? "Atividade";
  const [subject, setSubject] = useState(request.subject ?? "");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindBefore, setRemindBefore] = useState("0");
  const [assigneeId, setAssigneeId] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extras, setExtras] = useState<ComposerExtrasState>(freshExtras);
  const [autoLinkCount, setAutoLinkCount] = useState(1);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [identity, setIdentity] = useState<WhatsAppIdentity>({});
  const [contactId, setContactId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const notify = useServerFn(notifyActivityEvent);
  useEffect(() => {
    let active = true;
    void resolveTimelineAutoLinks(request.relatedKey, request.relatedId).then((links) => { if (active) setAutoLinkCount(Object.values(links ?? {}).filter(Boolean).length || 1); });
    void fetchTimelineTarget(request.relatedKey, request.relatedId).then((target) => { if (active) setContactId(target?.contactId); });
    return () => { active = false; };
  }, [request.relatedKey, request.relatedId]);
  useEffect(() => { if (!user) return; let active = true; void fetchTimelineTeam(user).then((result) => { if (active) { setTeam(result.team); setIdentity(result.whatsappIdentity); } }); return () => { active = false; }; }, [user]);
  const save = async () => {
    if (!user || saving) return;
    if (!body.trim() && !subject.trim() && !pendingFiles.length) return toast.error("Adicione um assunto, texto ou anexo.");
    if (type === "task" && extras.recurrence && !dueDate) return toast.error("Defina a data de vencimento para repetir a tarefa.");
    setSaving(true);
    try {
      const attachments: Attachment[] = pendingFiles.length ? await uploadTimelineFiles(user.id, pendingFiles) : [];
      const autoLinks = await resolveTimelineAutoLinks(request.relatedKey, request.relatedId);
      const waHtml = body ? maybeConvertWhatsAppPaste(body, identity) : null;
      const isTask = type === "task";
      const schedulable = isTask || type === "call" || type === "meeting";
      const res = await insertActivity({
        owner_id: user.id, assigned_to: isTask && assigneeId ? assigneeId : user.id, created_by: user.id,
        type, subject: subject || (waHtml ? "Conversa de WhatsApp" : null), body: waHtml ?? (body || null),
        due_date: schedulable && dueDate ? new Date(dueDate).toISOString() : null,
        remind_before_minutes: schedulable && dueDate && remindBefore !== "none" ? Number(remindBefore) : null,
        mentions: waHtml ? [] : extractMentionIds(body), attachments,
        activity_date: !isTask && extras.activityDate ? new Date(extras.activityDate).toISOString() : new Date().toISOString(),
        contacted_contact_ids: isTask ? [] : extras.contactedIds,
        ...(isTask ? { task_type: extras.taskType, task_priority: extras.priority === "none" ? null : extras.priority,
          task_status: extras.status, completed: extras.status === "completed", recurrence: extras.recurrence && dueDate ? { ...extras.recurrence, occurrence: 1 } : null } : {}),
        ...autoLinks,
      });
      if (!res.ok) return toast.error(res.error);
      if (res.insertedId) void notify({ data: { activityId: res.insertedId } }).catch(() => {});
      if (!isTask && extras.followUp.enabled) {
        const due = followUpDate(extras.followUp.preset, new Date(), extras.followUp.custom);
        const fu = await insertActivity({ owner_id: user.id, assigned_to: user.id, created_by: user.id, type: "task",
          task_type: extras.followUp.taskType, task_status: "not_started", subject: `Acompanhar: ${subject || label}`,
          due_date: due ? due.toISOString() : null, follow_up_of: res.insertedId ?? null, ...autoLinks });
        if (fu.ok) toast.success("Tarefa de acompanhamento criada");
        else toast.error(`Atividade salva, mas a tarefa de acompanhamento falhou: ${fu.error}`);
      }
      window.dispatchEvent(new CustomEvent("activities:changed"));
      onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao registrar atividade"); }
    finally { setSaving(false); }
  };
  return <div aria-busy={saving} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setPendingFiles((p) => [...p, ...Array.from(e.dataTransfer.files)]); }}>
    <TimelineComposer type={type} label={label} currentUserId={user?.id} team={team} subject={subject} onSubjectChange={setSubject}
      body={body} onBodyChange={setBody} onMentionAdd={() => {}} dueDate={dueDate} onDueDateChange={setDueDate}
      remindBefore={remindBefore} onRemindBeforeChange={setRemindBefore} assigneeId={assigneeId} onAssigneeChange={setAssigneeId}
      pendingFiles={pendingFiles} onPendingFilesChange={setPendingFiles} onOpenFileCenter={() => setPickerOpen(true)}
      onClose={onSaved} onSave={() => void save()} extras={extras} onExtrasChange={(p) => setExtras((old) => ({ ...old, ...p }))}
      associationsCount={autoLinkCount} defaultContactId={contactId} />
    <FileCenterPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPicked={(files) => setPendingFiles((p) => [...p, ...files])} />
  </div>;
}
