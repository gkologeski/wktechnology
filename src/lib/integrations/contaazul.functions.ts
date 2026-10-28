import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
// Server functions (RPC) da integração Conta Azul → TechFinance.
// Arquivo fino: apenas imports client-safe e declarações de server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CA_ENTITIES } from "./contaazul-map";

const entitySchema = z.enum([
  "categories",
  "cost-centers",
  "bank-accounts",
  "receivable",
  "payable",
  "statements",
]);

/** Estado da conexão + último resultado por entidade. */
export const contaAzulStatus = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.integrations", "view")])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, api, steps] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-api.server"),
      import("./contaazul-steps.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const integration = await api.loadIntegration(supabaseAdmin, workspaceId);
    const state = await steps.loadSyncState(supabaseAdmin, workspaceId);
    const tokens = integration?.oauth_tokens ?? null;

    // Últimas execuções do agendador (job "contaazul-tick", a cada 6 horas).
    const runCols =
      "id, started_at, finished_at, duration_ms, status, metrics, error, workspace_id";
    const { data: wsRuns } = await supabaseAdmin
      .from("cron_run_logs")
      .select(runCols)
      .eq("job_name", "contaazul-tick")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(5);

    // Só execuções do próprio workspace (logs globais não são expostos).
    const runs = wsRuns ?? [];

    return {
      configured: api.contaAzulConfigured(),
      connected: !!tokens?.access_token,
      status: integration?.status ?? "disconnected",
      lastError: (integration?.config as { last_error?: string } | null)?.last_error ?? null,
      expiresAt: tokens?.expires_at ?? null,
      entities: CA_ENTITIES,
      syncState: state,
      cronSchedule: "0 */6 * * *",
      cronRuns: ((runs ?? []) as Array<Record<string, unknown>>).map((r) => {
        const m = (r["metrics"] ?? {}) as Record<string, unknown>;
        const num = (v: unknown) => (typeof v === "number" ? v : 0);
        return {
          id: String(r["id"] ?? ""),
          startedAt: (r["started_at"] as string | null) ?? null,
          finishedAt: (r["finished_at"] as string | null) ?? null,
          durationMs: (r["duration_ms"] as number | null) ?? null,
          status: (r["status"] as string | null) ?? null,
          error: (r["error"] as string | null) ?? null,
          scope: r["workspace_id"] ? ("workspace" as const) : ("global" as const),
          workspaces: num(m["workspaces"]),
          imported: num(m["imported"]),
          updated: num(m["updated"]),
          failed: num(m["failed"]),
        };
      }),
    };
  });

/** URL de autorização OAuth (abre em popup). */
export const contaAzulAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const [
      { resolveActiveWorkspace },
      api,
      { signContaAzulState },
      { supabaseAdmin },
      diagnostics,
      { assertAnyPermission },
      { INTEGRATIONS_MANAGE },
    ] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("./contaazul-api.server"),
      import("./contaazul-state.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-oauth-diagnostics.server"),
      import("@/lib/access-control/enforce.server"),
      import("@/lib/access-control/admin-permission-keys"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, workspaceId, INTEGRATIONS_MANAGE);
    const origin = api.normalizeContaAzulReturnOrigin(data.origin);
    const state = signContaAzulState({
      workspaceId,
      userId: context.userId,
      origin,
    });
    await diagnostics.markContaAzulAuthorizationStarted(supabaseAdmin, workspaceId);
    return { url: api.buildAuthorizeUrl({ origin, state }) };
  });

/** Configuração efetiva e último erro OAuth, sempre sem segredos. */
export const contaAzulOAuthDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const [
      { resolveActiveWorkspace },
      { supabaseAdmin },
      diagnostics,
      api,
      { assertAnyPermission },
      { INTEGRATIONS_MANAGE },
    ] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-oauth-diagnostics.server"),
      import("./contaazul-api.server"),
      import("@/lib/access-control/enforce.server"),
      import("@/lib/access-control/admin-permission-keys"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, workspaceId, INTEGRATIONS_MANAGE);
    const integration = await api.loadIntegration(supabaseAdmin, workspaceId);
    const configuration = diagnostics.getContaAzulOAuthConfiguration(data.origin);
    const lastDiagnostic =
      (integration?.config as { oauth_diagnostic?: unknown } | null)?.oauth_diagnostic ?? null;
    return { ...configuration, lastDiagnostic };
  });

export const contaAzulDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    {
      const [{ assertAnyPermission }, { INTEGRATIONS_MANAGE }] = await Promise.all([
        import("@/lib/access-control/enforce.server"),
        import("@/lib/access-control/admin-permission-keys"),
      ]);
      await assertAnyPermission(context.supabase, context.userId, workspaceId, INTEGRATIONS_MANAGE);
    }
    const { error } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "disconnected",
        oauth_tokens: null,
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "contaazul")
      .eq("owner_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Executa a importação/sincronização das entidades escolhidas. */
export const contaAzulRunSync = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) =>
    z
      .object({
        entities: z.array(entitySchema).min(1),
        since: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, steps] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-steps.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    {
      const [{ assertAnyPermission }, { INTEGRATIONS_MANAGE }] = await Promise.all([
        import("@/lib/access-control/enforce.server"),
        import("@/lib/access-control/admin-permission-keys"),
      ]);
      await assertAnyPermission(context.supabase, context.userId, workspaceId, INTEGRATIONS_MANAGE);
    }
    const results = await steps.runContaAzulSteps(
      { supabase: supabaseAdmin, workspaceId, userId: context.userId, since: data.since ?? null },
      data.entities,
    );
    return { results };
  });

/** Importa lançamentos normalizados a partir de arquivo (fallback CSV). */
export const contaAzulImportFileEntries = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) =>
    z
      .object({
        direction: z.enum(["receivable", "payable"]),
        entries: z
          .array(
            z.object({
              externalId: z.string(),
              externalRef: z.string(),
              direction: z.enum(["receivable", "payable"]),
              description: z.string().min(1),
              amount: z.number(),
              paidAmount: z.number(),
              dueDate: z.string(),
              competenceDate: z.string(),
              status: z.enum(["open", "partial", "paid", "overdue", "cancelled"]),
              installmentNumber: z.number().nullable(),
              installmentTotal: z.number().nullable(),
              categoryExternalId: z.string().nullable(),
              costCenterExternalId: z.string().nullable(),
              counterpartyName: z.string().nullable(),
              counterpartyDoc: z.string().nullable(),
              paymentMethod: z.string().nullable(),
              raw: z.record(z.string(), z.unknown()),
            }),
          )
          .min(1)
          .max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, steps] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-steps.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    {
      const [{ assertAnyPermission }, { INTEGRATIONS_MANAGE }] = await Promise.all([
        import("@/lib/access-control/enforce.server"),
        import("@/lib/access-control/admin-permission-keys"),
      ]);
      await assertAnyPermission(context.supabase, context.userId, workspaceId, INTEGRATIONS_MANAGE);
    }
    const result = await steps.persistEntries(
      { supabase: supabaseAdmin, workspaceId, userId: context.userId },
      data.direction,
      data.entries,
    );
    await steps.saveSyncState(supabaseAdmin, workspaceId, result);
    return result;
  });

/** Lista a conciliação de clientes/fornecedores (RLS do próprio usuário). */
export const contaAzulPeopleList = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "view")])
  .inputValidator((input) =>
    z
      .object({
        tab: z.enum(["suggested", "review", "new", "linked", "decided"]),
        search: z.string().max(200).optional(),
        page: z.number().int().min(0).max(1000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "view");
    const statuses = data.tab === "decided" ? ["confirmed", "ignored"] : [data.tab];
    let q = context.supabase
      .from("contaazul_person_links")
      .select(
        "id, name, person_kind, profile, document, email, status, match_by, score, candidates, local_company_id, local_contact_id, decided_at",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .in("status", statuses)
      .order("score", { ascending: false, nullsFirst: false })
      .order("name")
      .range(data.page * 50, data.page * 50 + 49);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim().replace(/[%_,]/g, " ")}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const { data: all, error: cErr } = await context.supabase
      .from("contaazul_person_links")
      .select("status")
      .eq("workspace_id", workspaceId);
    if (cErr) throw new Error(cErr.message);
    const totals: Record<string, number> = {};
    for (const r of all ?? []) totals[r.status] = (totals[r.status] ?? 0) + 1;
    return { rows: rows ?? [], total: count ?? 0, totals };
  });

/** Lê clientes/fornecedores do Conta Azul e recalcula sugestões (só a lista de vínculos). */
export const contaAzulPeopleRefresh = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "manage");
    const { data: ok } = await context.supabase.rpc("sales_contaazul_authorize", {
      p_user: context.userId,
      p_ws: workspaceId,
      p_entity: "connection",
    });
    if (ok !== true) throw new Error("Sem permissão de gestão da integração Conta Azul.");
    return { counts: await people.refreshPeopleLinks(supabaseAdmin, workspaceId) };
  });

/** Confirma, troca, marca como nova (somente financeiro), ignora ou reabre vínculos. */
export const contaAzulPeopleDecide = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        action: z.enum(["confirm", "choose", "new", "ignore", "reopen"]),
        localId: z.string().uuid().nullable().optional(),
      })
      .refine((v) => v.action !== "choose" || (!!v.localId && v.ids.length === 1), {
        message: "Escolha um único cadastro para vincular.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "manage");
    const changed = await people.decidePeopleLinks(supabaseAdmin, {
      workspaceId,
      userId: context.userId,
      ids: data.ids,
      action: data.action,
      localId: data.localId ?? null,
    });
    return { changed };
  });
