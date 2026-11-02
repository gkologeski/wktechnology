import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { compileAudienceGroups } from "@/lib/whatsapp/campaign-audience-query";
import { cohortCandidates } from "./enrollment";
import { definitionSchema, SEQUENCE_RESOURCE, subscriptionInput } from "./draft";
import { preflightSequenceDefinition } from "./releases.server";
import {
  normalizeAudienceGroups,
  isAllowedFilter,
  type AudienceRow,
} from "@/lib/whatsapp/campaign-audience";
import {
  buildServerFilterFields,
  loadServerFilterFields,
  type ServerFilterMetadata,
} from "@/lib/whatsapp/campaign-audience.server";
export type DynamicSubscriptionStatus = {
  id: string;
  ownerId: string;
  enabled: boolean;
  lastScanAt: string | null;
  nextScanAt: string;
  errorCode: string | null;
  matched: number | null;
  started: number | null;
  reasons: Record<string, number> | null;
};
export async function setSequenceSubscription(
  client: SupabaseClient,
  input: z.infer<typeof subscriptionInput>,
) {
  const data = subscriptionInput.parse(input);
  await assertSalesArea(client, SEQUENCE_RESOURCE, "manage");
  if (data.enabled) await assertSalesArea(client, SEQUENCE_RESOURCE, "assign");
  const ctx = await workRpc<{ workspace: string; actor: string; read_only: boolean }>(
    client,
    "sales_access_context",
    {},
  );
  if (ctx.workspace !== data.workspaceId || !ctx.actor || ctx.read_only)
    throw new Error("Workspace indisponível.");
  if (data.enabled) {
    const version = await client
      .from("prospecting_sequence_versions" as never)
      .select("definition")
      .eq("id", data.versionId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (version.error || !version.data) throw new Error("Versão indisponível.");
    const definition = definitionSchema.parse((version.data as { definition: unknown }).definition);
    if (definition.audience.entry !== "dynamic")
      throw new Error("Salve uma versão com entrada dinâmica antes de ativar.");
    const groups = normalizeAudienceGroups(definition.audience);
    if (groups.length) {
      const fields = await loadServerFilterFields(client, data.workspaceId, ctx.actor);
      if (
        groups.some((g) =>
          g.filters.some((f) => !isAllowedFilter(definition.audience.base, f, fields)),
        )
      )
        throw new Error("Filtro não permitido ou indisponível nesta versão.");
    }
    const report = await preflightSequenceDefinition(
      client,
      data.workspaceId,
      ctx.actor,
      definition,
    );
    if (!report.configurationValid)
      throw new Error(report.issues[0]?.message || "Revise os canais.");
  }
  return workRpc<string | null>(client, "prospecting_sequence_subscription_set", {
    p_workspace: data.workspaceId,
    p_version: data.versionId,
    p_enabled: data.enabled,
    p_consent: data.consentEvidence,
  });
}
const sourceSchema = z
  .object({ email: z.string().nullable(), phones: z.array(z.string().nullable()).length(3) })
  .passthrough();
export function dynamicCandidates(
  sources: Record<string, unknown>,
  definition: z.infer<typeof definitionSchema>,
) {
  const rows: AudienceRow[] = Object.entries(sources).map(([key, value]) => {
    const [entity, id] = key.split(":");
    if ((entity !== "lead" && entity !== "contact") || !z.string().uuid().safeParse(id).success)
      throw new Error("Invalid protected source");
    const source = sourceSchema.parse(value);
    return {
      sourceType: entity,
      sourceId: id,
      contactId: entity === "contact" ? id : null,
      phone: null,
      phones: source.phones,
      label: id,
      values: { [entity + ".email"]: source.email },
    };
  });
  return cohortCandidates(rows, definition);
}
/** No provider calls here. Actor-projected audience + enrollment/start are checked again atomically in SQL. */
export async function scanSequenceSubscription(
  admin: SupabaseClient,
  subscription: { id: string; workspace_id: string; version_id: string; lease_token: string },
) {
  try {
    const version = await admin
      .from("prospecting_sequence_versions" as never)
      .select("definition")
      .eq("id", subscription.version_id)
      .eq("workspace_id", subscription.workspace_id)
      .maybeSingle();
    if (version.error || !version.data) throw new Error("Version unavailable");
    const definition = definitionSchema.parse((version.data as { definition: unknown }).definition);
    if (definition.audience.entry !== "dynamic") throw new Error("Not dynamic");
    const groups = normalizeAudienceGroups(definition.audience);
    if (groups.length) {
      const metadata = await workRpc<ServerFilterMetadata>(
        admin,
        "prospecting_sequence_subscription_catalog",
        { p_subscription: subscription.id, p_lease: subscription.lease_token },
      );
      const fields = await buildServerFilterFields(metadata);
      if (
        groups.some((g) =>
          g.filters.some((f) => !isAllowedFilter(definition.audience.base, f, fields)),
        )
      )
        throw new Error("Filtro não permitido ou indisponível nesta versão.");
    }
    const batch = await workRpc<{
      sources: Record<string, unknown>;
      matchedCount: number;
      policyClock: string | null;
    }>(admin, "prospecting_sequence_subscription_candidates", {
      p_subscription: subscription.id,
      p_lease: subscription.lease_token,
      p_groups: compileAudienceGroups(definition.audience.base, groups),
    });
    const candidates = dynamicCandidates(batch.sources, definition);
    const matched = z.number().int().min(0).max(5000).parse(batch.matchedCount);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ candidates, policyClock: batch.policyClock }))
      .digest("hex");
    return await workRpc<{ started: number; matched: number }>(
      admin,
      "prospecting_sequence_subscription_commit",
      {
        p_subscription: subscription.id,
        p_lease: subscription.lease_token,
        p_fingerprint: fingerprint,
        p_matched: matched,
        p_candidates: candidates,
      },
    );
  } catch (error) {
    const code =
      error instanceof Error && error.message.includes("O público dinâmico excede 5.000 registros.")
        ? "audience_limit"
        : "scan_unavailable";
    await workRpc(admin, "prospecting_sequence_subscription_error", {
      p_subscription: subscription.id,
      p_lease: subscription.lease_token,
      p_error: code,
    });
    return { started: 0, matched: 0, error: "scan_unavailable" as const };
  }
}
export async function tickSequenceSubscriptions(admin: SupabaseClient) {
  const subscriptions = await workRpc<
    { id: string; workspace_id: string; version_id: string; lease_token: string }[]
  >(admin, "prospecting_sequence_subscription_claim", { p_limit: 1 });
  const results = [];
  for (const subscription of subscriptions)
    results.push(await scanSequenceSubscription(admin, subscription));
  return {
    scanned: results.length,
    started: results.reduce((n, r) => n + r.started, 0),
    failed: results.filter((r) => "error" in r).length,
  };
}
