// Fetches/syncs deal loss reasons. Source of truth = public.deal_loss_reasons.
// Sync action pulls options from HubSpot property `deals/closed_lost_reason` and upserts them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

export type LossReasonOption = {
  id: string;
  value: string;
  label: string;
  is_active: boolean;
  source: string;
  sort_order: number;
};

async function listFromDb(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
  includeInactive = false,
) {
  let q = supabase
    .from("deal_loss_reasons")
    .select("id, value, label, is_active, source, sort_order")
    .eq("owner_id", workspaceId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LossReasonOption[];
}

export const getDealLossReasons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { includeInactive?: boolean } | undefined) =>
    z
      .object({ includeInactive: z.boolean().optional() })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const options = await listFromDb(
      context.supabase,
      workspaceId,
      data?.includeInactive ?? false,
    );
    return { options };
  });

export const syncHubspotLossReasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
    if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
      throw new Error("Conecte o HubSpot para sincronizar os motivos.");
    }
    const workspaceId = await resolveActiveWorkspace(context.userId);

    const res = await fetch(`${GATEWAY_URL}/crm/v3/properties/deals/closed_lost_reason`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": HUBSPOT_API_KEY,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot [${res.status}]: ${body.slice(0, 200)}`);
    }
    const payload = (await res.json()) as {
      options?: Array<{ label?: string; value?: string; hidden?: boolean; displayOrder?: number }>;
    };
    const incoming = (payload.options ?? [])
      .filter((o) => o.value && !o.hidden)
      .map((o, i) => ({
        owner_id: workspaceId,
        value: String(o.value),
        label: o.label || String(o.value),
        source: "hubspot",
        hubspot_synced_at: new Date().toISOString(),
        is_active: true,
        sort_order: typeof o.displayOrder === "number" ? o.displayOrder : i,
      }));

    if (!incoming.length) {
      return { upserted: 0, deactivated: 0 };
    }

    const { error: upsertErr } = await context.supabase
      .from("deal_loss_reasons")
      .upsert(incoming, { onConflict: "owner_id,value" });
    if (upsertErr) throw new Error(upsertErr.message);

    // Deactivate HubSpot-sourced reasons not present anymore
    const keep = incoming.map((i) => i.value);
    const { data: stale } = await context.supabase
      .from("deal_loss_reasons")
      .select("id")
      .eq("owner_id", workspaceId)
      .eq("source", "hubspot")
      .not("value", "in", `(${keep.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`);
    let deactivated = 0;
    if (stale && stale.length) {
      const ids = (stale as { id: string }[]).map((r) => r.id);
      const { error: deactErr } = await context.supabase
        .from("deal_loss_reasons")
        .update({ is_active: false })
        .in("id", ids);
      if (!deactErr) deactivated = ids.length;
    }

    return { upserted: incoming.length, deactivated };
  });
