// Server functions (RPC) da integração Conta Azul → TechFinance.
// Arquivo fino: apenas imports client-safe e declarações de server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { CA_ENTITIES } from "./contaazul-map";

const entitySchema = z.enum(["categories", "cost-centers", "bank-accounts", "receivable", "payable", "statements"]);

/** Estado da conexão + último resultado por entidade. */
export const contaAzulStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
    return {
      configured: api.contaAzulConfigured(),
      connected: !!tokens?.access_token,
      status: integration?.status ?? "disconnected",
      lastError: (integration?.config as { last_error?: string } | null)?.last_error ?? null,
      expiresAt: tokens?.expires_at ?? null,
      entities: CA_ENTITIES,
      syncState: state,
    };
  });

/** URL de autorização OAuth (abre em popup). */
export const contaAzulAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, api, { signContaAzulState }] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("./contaazul-api.server"),
      import("./contaazul-state.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const state = signContaAzulState({
      workspaceId,
      userId: context.userId,
      origin: data.origin,
    });
    return { url: api.buildAuthorizeUrl({ origin: data.origin, state }) };
  });

export const contaAzulDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
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
  .middleware([requireSupabaseAuth])
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
    const results = await steps.runContaAzulSteps(
      { supabase: supabaseAdmin, workspaceId, userId: context.userId, since: data.since ?? null },
      data.entities,
    );
    return { results };
  });

/** Importa lançamentos normalizados a partir de arquivo (fallback CSV). */
export const contaAzulImportFileEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const result = await steps.persistEntries(
      { supabase: supabaseAdmin, workspaceId, userId: context.userId },
      data.direction,
      data.entries,
    );
    await steps.saveSyncState(supabaseAdmin, workspaceId, result);
    return result;
  });
