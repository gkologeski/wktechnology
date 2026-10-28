import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";

/** Simula a importação completa: só lê o Conta Azul e o TechERP. */
export const contaAzulFullImportPreview = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, imp] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-full-import.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return {
      summary: await imp.previewFullImport({
        admin: supabaseAdmin,
        client: context.supabase,
        workspaceId,
        userId: context.userId,
      }),
    };
  });

/** Grava o que falta (vínculos, cadastros, lançamentos, baixas, transferências). */
export const contaAzulFullImportApply = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) => z.object({ confirm: z.literal(true) }).parse(input))
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, imp] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-full-import.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return imp.applyFullImport({
      admin: supabaseAdmin,
      client: context.supabase,
      workspaceId,
      userId: context.userId,
    });
  });

/** Desfaz uma execução: remove o que ela criou e as baixas que lançou. */
export const contaAzulFullImportRollback = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, imp] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-full-import.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return {
      removed: await imp.rollbackFullImport(
        { admin: supabaseAdmin, client: context.supabase, workspaceId, userId: context.userId },
        data.runId,
      ),
    };
  });

/** Execuções e lançamentos em revisão (leitura após checar a permissão). */
export const contaAzulFullImportStatus = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "view")])
  .inputValidator((input) =>
    z.object({ page: z.number().int().min(0).max(1000).default(0) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "view");
    const [runs, review] = await Promise.all([
      supabaseAdmin
        .from("contaazul_import_runs")
        .select("id, status, summary, error, started_at, finished_at, rolled_back_at")
        .eq("workspace_id", workspaceId)
        .order("started_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("contaazul_record_links")
        .select("id, entity, tier, label, candidates, decision", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("status", "review")
        .order("decision", { ascending: true, nullsFirst: true })
        .order("label")
        .range(data.page * 50, data.page * 50 + 49),
    ]);
    if (runs.error) throw new Error(runs.error.message);
    if (review.error) throw new Error(review.error.message);
    return { runs: runs.data ?? [], review: review.data ?? [], reviewTotal: review.count ?? 0 };
  });

/** Decide um item em revisão: mesmo lançamento, criar novo ou ignorar. */
export const contaAzulFullImportDecide = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        decision: z.enum(["same", "new", "ignore"]),
        localId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, imp] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-full-import.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return {
      changed: await imp.decideRecordLinks(
        { admin: supabaseAdmin, client: context.supabase, workspaceId, userId: context.userId },
        data.ids,
        data.decision,
        data.localId ?? null,
      ),
    };
  });
