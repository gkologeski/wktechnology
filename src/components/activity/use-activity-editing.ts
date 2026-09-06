// Estado e gravação da edição inline de uma atividade da timeline.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { useState } from "react";
import { toast } from "sonner";
import type { Activity } from "@/lib/db-types";
import type { Attachment } from "@/components/activity/timeline-shared";
import { uploadTimelineFiles } from "@/lib/timeline/activity-entities";
import { activityAttachments, updateActivity } from "@/lib/timeline/activity-mutations";

export function useActivityEditing(userId: string | undefined, onSaved: () => void) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setBody(a.body ?? "");
    setAttachments(activityAttachments(a));
    setNewFiles([]);
    setAssigneeId(
      a.type === "task" ? ((a as unknown as { owner_id?: string | null }).owner_id ?? null) : null,
    );
    setDueDate(a.type === "task" ? (a.due_date ?? null) : null);
  };

  const saveEdit = async (a: Activity) => {
    const uploaded =
      !userId || newFiles.length === 0 ? [] : await uploadTimelineFiles(userId, newFiles);
    const patch: Record<string, unknown> = {
      body: body || null,
      attachments: [...attachments, ...uploaded],
    };
    if (a.type === "task") {
      patch.owner_id = assigneeId ?? userId ?? null;
      patch.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    }
    const res = await updateActivity(a.id, patch);
    if (!res.ok) return toast.error(res.error);
    setEditingId(null);
    setAttachments([]);
    setNewFiles([]);
    setAssigneeId(null);
    setDueDate(null);
    onSaved();
  };

  return {
    editingId,
    setEditingId,
    body,
    setBody,
    attachments,
    setAttachments,
    newFiles,
    setNewFiles,
    assigneeId,
    setAssigneeId,
    dueDate,
    setDueDate,
    pickerOpen,
    setPickerOpen,
    startEdit,
    saveEdit,
  };
}
