// Gravações da timeline: criação, conclusão, exclusão e edição de atividades.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { supabase } from "@/integrations/supabase/client";
import { deleteRowGuarded } from "@/lib/delete-guard";
import type { Activity } from "@/lib/db-types";
import type { Attachment } from "@/components/activity/timeline-shared";

export type MutationResult = { ok: boolean; error?: string; insertedId?: string };

export async function insertActivity(payload: Record<string, unknown>): Promise<MutationResult> {
  const { data, error } = await supabase
    .from("activities")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, insertedId: data?.id };
}

export async function toggleActivityDone(a: Activity): Promise<MutationResult> {
  const { error } = await supabase
    .from("activities")
    .update({ completed: !a.completed })
    .eq("id", a.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeActivity(id: string): Promise<MutationResult> {
  const res = await deleteRowGuarded("activities", id);
  return res.ok ? { ok: true } : { ok: false, error: res.message };
}

export async function updateActivity(
  id: string,
  patch: Record<string, unknown>,
): Promise<MutationResult> {
  const { error } = await supabase
    .from("activities")
    .update(patch as never)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Anexos existentes de uma atividade, com o tipo já estreitado. */
export function activityAttachments(a: Activity): Attachment[] {
  return (a as unknown as { attachments?: Attachment[] }).attachments ?? [];
}
