import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { Activity } from "@/lib/db-types";
import { ActivityEditForm } from "./activity-edit-form";
import type { Attachment, TeamMember } from "./timeline-shared";
import { fetchTimelineTeam, uploadTimelineFiles } from "@/lib/timeline/activity-entities";
import { activityAttachments, updateActivity } from "@/lib/timeline/activity-mutations";
import { maybeConvertWhatsAppPaste, type WhatsAppIdentity } from "@/lib/whatsapp-paste";
import { useEffect } from "react";
import { activityDraftKey, useActivityDraft } from "@/hooks/use-activity-draft";
import { DraftBar } from "./activity-draft-bar";

export function ActivityEditWindow({
  activity,
  onSaved,
  onCancel,
}: {
  activity: Activity;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [identity, setIdentity] = useState<WhatsAppIdentity>({});
  const [body, setBody] = useState(activity.body ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(
    activity.type === "task"
      ? ((activity as Activity & { assigned_to?: string | null }).assigned_to ?? activity.owner_id)
      : null,
  );
  const [dueDate, setDueDate] = useState<string | null>(
    activity.type === "task" ? activity.due_date : null,
  );
  const [attachments, setAttachments] = useState<Attachment[]>(() => activityAttachments(activity));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const draft = useActivityDraft({
    key: activityDraftKey(user?.id, ["edit", activity.id]),
    value: { body, assigneeId, dueDate },
    isEmpty: (v) =>
      v.body === (activity.body ?? "") &&
      v.dueDate === (activity.type === "task" ? activity.due_date : null),
    onRestore: (v) => {
      setBody(v.body ?? "");
      setAssigneeId(v.assigneeId ?? null);
      setDueDate(v.dueDate ?? null);
    },
  });
  const discard = () => {
    if (!window.confirm("Descartar este rascunho?")) return;
    draft.clear();
    setBody(activity.body ?? "");
    setDueDate(activity.type === "task" ? activity.due_date : null);
  };
  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchTimelineTeam(user).then((result) => {
      if (active) {
        setTeam(result.team);
        setIdentity(result.whatsappIdentity);
      }
    });
    return () => {
      active = false;
    };
  }, [user]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const uploaded =
        !user || !newFiles.length ? [] : await uploadTimelineFiles(user.id, newFiles);
      const patch: Record<string, unknown> = {
        body: (body ? maybeConvertWhatsAppPaste(body, identity) : null) ?? (body || null),
        attachments: [...attachments, ...uploaded],
      };
      if (activity.type === "task") {
        patch.assigned_to = assigneeId ?? user?.id ?? null;
        patch.due_date = dueDate ? new Date(dueDate).toISOString() : null;
      }
      const res = await updateActivity(activity.id, patch);
      if (!res.ok) return toast.error(res.error);
      draft.clear();
      window.dispatchEvent(new CustomEvent("activities:changed"));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar atividade");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div aria-busy={saving}>
      <DraftBar savedAt={draft.savedAt} onDiscard={discard} />
      <div className="p-4">
        <h2 className="font-semibold">
          Editar {activity.type === "task" ? "tarefa" : "atividade"}
        </h2>
        <ActivityEditForm
          activity={activity}
          team={team}
          body={body}
          onBodyChange={setBody}
          assigneeId={assigneeId}
          onAssigneeChange={setAssigneeId}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          newFiles={newFiles}
          onNewFilesChange={setNewFiles}
          onOpenFileCenter={() => toast.info("Use Anexar para escolher arquivos.")}
          onSave={() => void save()}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
