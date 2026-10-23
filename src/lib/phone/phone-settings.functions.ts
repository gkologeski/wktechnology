import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asCountry, maskPhone } from "@/lib/phone/e164";
import {
  PHONE_REVIEW_CLASSES,
  phoneEntityName,
  phoneReviewDetail,
  phoneEntityRoute,
  type PhoneEntityRoute,
} from "@/lib/phone/phone-review";

export type PhoneRunSummary = {
  id: string;
  finishedAt: string | null;
  version: string;
  criteria: string;
  counts: Record<string, Record<string, number>>;
  applied: Record<string, number>;
  /** Correções posteriores (execuções filhas): itens da fila resolvidos por campo e tipo. */
  resolved: Record<string, Record<string, number>>;
  /** Data da correção posterior mais recente. */
  correctedAt: string | null;
};

export type PhoneReviewItem = {
  id: number;
  table: string;
  column: string;
  rowId: string;
  /** Nome do registro visível ao usuário (RLS); nulo quando não visível. */
  name: string | null;
  /** Ficha a abrir; nulo quando a tabela não tem ficha ou o registro não é visível. */
  route: PhoneEntityRoute | null;
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
        .is("parent_run_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    // Correções posteriores concluídas que resolvem parte da fila da varredura.
    const { data: children } = run
      ? await supabase
          .from("phone_normalization_runs")
          .select("finished_at, counts")
          .eq("workspace_id", workspaceId)
          .eq("parent_run_id", run.id as string)
          .eq("status", "done")
          .order("created_at", { ascending: true })
      : { data: [] };
    const resolved: Record<string, Record<string, number>> = {};
    let correctedAt: string | null = null;
    for (const c of children ?? []) {
      const r = ((c.counts as Record<string, unknown> | null)?.resolved ?? {}) as Record<
        string,
        Record<string, number>
      >;
      for (const [field, byRes] of Object.entries(r)) {
        resolved[field] ??= {};
        for (const [k, n] of Object.entries(byRes))
          resolved[field][k] = (resolved[field][k] ?? 0) + n;
      }
      correctedAt = (c.finished_at as string | null) ?? correctedAt;
    }
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
            resolved,
            correctedAt,
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
      .is("resolved_at", null)
      .in("classification", data.classification ? [data.classification] : [...PHONE_REVIEW_CLASSES])
      .order("id")
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Nomes dos registros da página, lidos com o cliente do usuário (RLS):
    // quem não pode ver o registro recebe o item sem nome.
    const idsOf = (t: string) => [
      ...new Set(list.filter((r) => r.table_name === t).map((r) => r.row_id as string)),
    ];
    type NameRow = { id: string } & Parameters<typeof phoneEntityName>[0];
    const sb = context.supabase;
    const fetchers: Record<string, (ids: string[]) => PromiseLike<{ data: NameRow[] | null }>> = {
      contacts: (ids) =>
        sb.from("contacts").select("id, first_name, last_name, email").in("id", ids),
      leads: (ids) => sb.from("leads").select("id, first_name, last_name, email").in("id", ids),
      companies: (ids) => sb.from("companies").select("id, name").in("id", ids),
      people: (ids) => sb.from("people").select("id, full_name, email").in("id", ids),
      ats_candidates: (ids) =>
        sb.from("ats_candidates").select("id, full_name, email").in("id", ids),
      profiles: (ids) => sb.from("profiles").select("id, full_name").in("id", ids),
    };
    const names = new Map<string, string>();
    await Promise.all(
      Object.entries(fetchers).map(async ([table, fetch]) => {
        const ids = idsOf(table);
        if (!ids.length) return;
        const { data: found } = await fetch(ids);
        for (const r of found ?? []) {
          const n = phoneEntityName(r);
          if (n) names.set(`${table}:${r.id}`, n);
        }
      }),
    );

    return {
      total: count ?? 0,
      pageSize,
      items: list.map((r): PhoneReviewItem => {
        const table = r.table_name as string;
        const rowId = r.row_id as string;
        const name = names.get(`${table}:${rowId}`) ?? null;
        return {
          id: r.id as number,
          table,
          column: r.column_name as string,
          rowId,
          name,
          route: name ? phoneEntityRoute(table) : null,
          masked: maskPhone(r.original_value as string | null),
          classification: r.classification as string,
          // Motivo específico calculado na hora pela mesma regra (candidato mascarado).
          reason:
            phoneReviewDetail(r.original_value as string | null) ??
            ((r.reason as string | null) || null),
        };
      }),
    };
  });
