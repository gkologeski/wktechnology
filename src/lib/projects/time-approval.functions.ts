// TechProjects — fluxo de aprovação de horas (compatível com as telas que passam ids de apontamento).
// Rascunho → Enviado (envio versionado) → Aprovado | Devolvido → editar volta a Rascunho.
// Tudo passa pelas funções do banco: autoaprovação proibida, aprovador explícito, conflito de versão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { cleanDbError, browserTimeZone } from "@/lib/projects/time-entry.shared";
import type { SubmissionPreview } from "@/lib/projects/time-workflow.types";
import { emitTimeEntryEvent, pendingItemsFor } from "@/lib/projects/time-approval.server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const ids = z.array(z.string().uuid()).min(1).max(500);

/** Profissional envia o período: prévia e envio atômico com o mesmo hash (falha se mudou). */
export const submitTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ from: isoDate, to: isoDate, timezone: z.string().max(64).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data: pv, error: pErr } = await supabase.rpc("project_timesheet_preview", {
      p_ws: ws,
      p_from: data.from,
      p_to: data.to,
    });
    if (pErr) throw new Error(cleanDbError(pErr.message));
    const preview = pv as unknown as SubmissionPreview;
    if (preview.blockers.length > 0)
      throw new Error(preview.blockers.map((b) => b.message).join(" "));
    if (preview.entry_count === 0) return { submitted: 0 };
    const { data: row, error } = await supabase.rpc("project_timesheet_submit", {
      p_ws: ws,
      p_from: data.from,
      p_to: data.to,
      p_expected_hash: preview.hash,
      p_tz: data.timezone ?? browserTimeZone(),
    });
    if (error) throw new Error(cleanDbError(error.message));
    return { submitted: (row as unknown as { entries: number }).entries };
  });

/** Aprovador explícito aprova; autoaprovação e conflito de versão são recusados no banco. */
export const approveTimeEntriesV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const items = await pendingItemsFor(supabase, data.ids);
    const { data: row, error } = await supabase.rpc("project_timesheet_decide", {
      p_ws: ws,
      p_items: items,
      p_action: "approve",
      p_reason: null as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    await emitTimeEntryEvent(supabase, ws, "time_entry.approved", data.ids);
    return { approved: (row as unknown as { decided: number }).decided };
  });

/** Aprovador devolve com motivo; o profissional corrige e reenvia. */
export const rejectTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids, reason: z.string().trim().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const items = await pendingItemsFor(supabase, data.ids);
    const { data: row, error } = await supabase.rpc("project_timesheet_decide", {
      p_ws: ws,
      p_items: items,
      p_action: "reject",
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    await emitTimeEntryEvent(supabase, ws, "time_entry.updated", data.ids);
    return { rejected: (row as unknown as { decided: number }).decided };
  });

/** Reabre aprovações (fora de competência fechada), com motivo e trilha. */
export const reopenTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids, reason: z.string().trim().min(5).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase.rpc("project_time_reopen_approval", {
      p_ws: ws,
      p_ids: data.ids,
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return { reopened: (row as unknown as { reopened: number }).reopened };
  });
