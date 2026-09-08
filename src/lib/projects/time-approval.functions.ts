// TechProjects — fluxo de aprovação de horas.
// Rascunho → Enviado → Aprovado (travado) | Rejeitado → volta a Rascunho ao editar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const ids = z.array(z.string().uuid()).min(1).max(500);

async function emitTimeEntryEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string | null,
  eventName: string,
  entryIds: string[],
) {
  if (!workspaceId) return;
  const { emitEvent } = await import("@/lib/events.server");
  for (const id of entryIds) {
    try {
      await emitEvent(supabase, {
        ownerId: workspaceId,
        eventName,
        source: "techprojects",
        entityType: "project_time_entry",
        entityId: id,
        payload: { time_entry_id: id },
      });
    } catch (err) {
      console.error("[time-approval] evento falhou", {
        eventName,
        id,
        error: (err as Error).message,
      });
    }
  }
}

/** Profissional envia os apontamentos de um período para aprovação. */
export const submitTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        ids: ids.optional(),
      })
      .refine((v) => v.ids || (v.from && v.to), {
        message: "Informe o período ou os apontamentos.",
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    let q = supabase
      .from("project_time_entries")
      .update({ status: "submitted", submitted_at: now, rejected_at: null, reject_reason: null })
      .eq("user_id", userId)
      .in("status", ["draft", "rejected"]);
    if (data.ids) q = q.in("id", data.ids);
    else q = q.gte("entry_date", data.from!).lte("entry_date", data.to!);
    const { data: rows, error } = await q.select("id, workspace_id");
    if (error) throw new Error(error.message);
    const updated = rows ?? [];
    await emitTimeEntryEvent(
      supabase,
      updated[0]?.workspace_id ?? null,
      "time_entry.updated",
      updated.map((r) => r.id),
    );
    return { submitted: updated.length };
  });

/** Gestor aprova apontamentos: marca aprovado e trava para edição. */
export const approveTimeEntriesV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: userId,
        rejected_at: null,
        reject_reason: null,
        locked_at: now,
      })
      .in("id", data.ids)
      .select("id, workspace_id");
    if (error) throw new Error(error.message);
    const updated = rows ?? [];
    if (updated.length === 0) {
      throw new Error("Nenhum apontamento aprovado: você não tem permissão para aprovar horas.");
    }
    await emitTimeEntryEvent(
      supabase,
      updated[0]?.workspace_id ?? null,
      "time_entry.approved",
      updated.map((r) => r.id),
    );
    return { approved: updated.length };
  });

/** Gestor rejeita apontamentos com motivo; voltam a ser editáveis. */
export const rejectTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids, reason: z.string().trim().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .update({
        status: "rejected",
        rejected_at: now,
        rejected_by: userId,
        reject_reason: data.reason,
        approved_at: null,
        approved_by: null,
        locked_at: null,
      })
      .in("id", data.ids)
      .select("id, workspace_id");
    if (error) throw new Error(error.message);
    const updated = rows ?? [];
    if (updated.length === 0) {
      throw new Error("Nenhum apontamento rejeitado: você não tem permissão para revisar horas.");
    }
    await emitTimeEntryEvent(
      supabase,
      updated[0]?.workspace_id ?? null,
      "time_entry.updated",
      updated.map((r) => r.id),
    );
    return { rejected: updated.length };
  });

/** Reabre apontamentos aprovados (desfaz a aprovação e o travamento). */
export const reopenTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .update({
        status: "draft",
        approved_at: null,
        approved_by: null,
        locked_at: null,
        submitted_at: null,
      })
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    if ((rows ?? []).length === 0) {
      throw new Error("Nenhum apontamento reaberto: você não tem permissão.");
    }
    return { reopened: (rows ?? []).length };
  });
