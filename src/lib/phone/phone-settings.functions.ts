import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asCountry, maskPhone } from "@/lib/phone/e164";
import { PHONE_REVIEW_CLASSES } from "@/lib/phone/phone-review";

export type PhoneRunSummary = {
  id: string;
  finishedAt: string | null;
  version: string;
  criteria: string;
  counts: Record<string, Record<string, number>>;
  applied: Record<string, number>;
};

export type PhoneReviewItem = {
  id: number;
  table: string;
  column: string;
  rowId: string;
  masked: string;
  classification: string;
  reason: string | null;
};

export const getPhoneSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    const workspaceId = typeof ws === "string" ? ws : null;
    if (!workspaceId) throw new Error("Workspace ativo não encontrado.");
    const [{ data: w }, { data: isAdmin }, { data: run }] = await Promise.all([
      supabase
        .from("workspaces")
        .select("default_phone_country, phone_strict_e164")
        .eq("id", workspaceId)
        .maybeSingle(),
      supabase.rpc("is_workspace_admin_v2", { _workspace: workspaceId, _user: userId }),
      // RLS: só administradores ativos do workspace leem as execuções.
      supabase
        .from("phone_normalization_runs")
        .select("id, finished_at, normalizer_version, criteria, counts, status")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const counts = (run?.counts ?? {}) as Record<string, unknown>;
    const { applied, ...byField } = counts as {
      applied?: Record<string, number>;
    } & Record<string, Record<string, number>>;
    return {
      workspaceId,
      country: (w?.default_phone_country as string | undefined) ?? "BR",
      strict: !!w?.phone_strict_e164,
      isAdmin: !!isAdmin,
      run: run
        ? ({
            id: run.id as string,
            finishedAt: (run.finished_at as string | null) ?? null,
            version: run.normalizer_version as string,
            criteria: run.criteria as string,
            counts: byField as Record<string, Record<string, number>>,
            applied: applied ?? {},
          } satisfies PhoneRunSummary)
        : null,
    };
  });

export const updatePhoneCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ country: z.string().length(2) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await (await import("@/lib/view-as-guard.server")).assertNotReadOnlyView(supabase);
    const country = asCountry(data.country);
    if (!country) throw new Error("País inválido.");
    const { data: ws } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    if (typeof ws !== "string") throw new Error("Workspace ativo não encontrado.");
    // RLS: só owner/admin do workspace atualiza (ws_update_admin).
    const { data: rows, error } = await supabase
      .from("workspaces")
      .update({ default_phone_country: country })
      .eq("id", ws)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Sem permissão para alterar o país padrão.");
    return { country };
  });

export const listPhoneReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        classification: z.enum(PHONE_REVIEW_CLASSES).optional(),
        page: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const pageSize = 50;
    const q = context.supabase
      .from("phone_normalization_items")
      .select("id, table_name, column_name, row_id, original_value, classification, reason", {
        count: "exact",
      })
      .eq("run_id", data.runId)
      .is("applied_at", null)
      .in("classification", data.classification ? [data.classification] : [...PHONE_REVIEW_CLASSES])
      .order("id")
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      total: count ?? 0,
      pageSize,
      items: (rows ?? []).map(
        (r): PhoneReviewItem => ({
          id: r.id as number,
          table: r.table_name as string,
          column: r.column_name as string,
          rowId: r.row_id as string,
          masked: maskPhone(r.original_value as string | null),
          classification: r.classification as string,
          reason: (r.reason as string | null) ?? null,
        }),
      ),
    };
  });
