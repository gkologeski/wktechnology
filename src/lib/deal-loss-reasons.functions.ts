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
    let options = await listFromDb(context.supabase, workspaceId, data?.includeInactive ?? false);
    if (options.length === 0 && process.env.LOVABLE_API_KEY && process.env.HUBSPOT_API_KEY) {
      try {
        await syncReasonsFromHubspot(context.supabase, workspaceId);
        options = await listFromDb(context.supabase, workspaceId, data?.includeInactive ?? false);
      } catch {
        // silent fail; user can trigger manually
      }
    }
    return { options };
  });

async function seedFromExistingDeals(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("deals")
    .select("closed_lost_reason")
    .eq("workspace_id", workspaceId)
    .not("closed_lost_reason", "is", null);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ closed_lost_reason: string | null }>) {
    const v = (r.closed_lost_reason ?? "").trim();
    if (v) set.add(v);
  }
  if (!set.size) return 0;
  const rows = Array.from(set).map((v, i) => ({
    owner_id: workspaceId,
    workspace_id: workspaceId,
    value: v,
    label: v,
    source: "hubspot",
    hubspot_synced_at: new Date().toISOString(),
    is_active: true,
    sort_order: i,
  }));
  const { error: upErr } = await supabase
    .from("deal_loss_reasons")
    .upsert(rows, { onConflict: "owner_id,value" });
  if (upErr) throw new Error(upErr.message);
  return rows.length;
}

async function syncReasonsFromHubspot(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
  propertyName: string = "closed_lost_reason",
): Promise<{ upserted: number; deactivated: number }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
    throw new Error("Conecte o HubSpot para sincronizar os motivos.");
  }

  const res = await fetch(
    `${GATEWAY_URL}/crm/v3/properties/deals/${encodeURIComponent(propertyName)}`,
    {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": HUBSPOT_API_KEY,
        "Content-Type": "application/json",
      },
    },
  );
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
      workspace_id: workspaceId,
      value: String(o.value),
      label: o.label || String(o.value),
      source: "hubspot",
      hubspot_synced_at: new Date().toISOString(),
      is_active: true,
      sort_order: typeof o.displayOrder === "number" ? o.displayOrder : i,
    }));

  if (!incoming.length) {
    // HubSpot property has no visible options — seed from existing lost deals.
    const seeded = await seedFromExistingDeals(supabase, workspaceId);
    return { upserted: seeded, deactivated: 0 };
  }

  const { error: upsertErr } = await supabase
    .from("deal_loss_reasons")
    .upsert(incoming, { onConflict: "owner_id,value" });
  if (upsertErr) throw new Error(upsertErr.message);

  const keep = incoming.map((i) => i.value);
  const { data: stale } = await supabase
    .from("deal_loss_reasons")
    .select("id")
    .eq("owner_id", workspaceId)
    .eq("source", "hubspot")
    .not("value", "in", `(${keep.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`);
  let deactivated = 0;
  if (stale && stale.length) {
    const ids = (stale as { id: string }[]).map((r) => r.id);
    const { error: deactErr } = await supabase
      .from("deal_loss_reasons")
      .update({ is_active: false })
      .in("id", ids);
    if (!deactErr) deactivated = ids.length;
  }

  return { upserted: incoming.length, deactivated };
}

export const syncHubspotLossReasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyName?: string } | undefined) =>
    z
      .object({ propertyName: z.string().trim().min(1).optional() })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return await syncReasonsFromHubspot(
      context.supabase,
      workspaceId,
      data?.propertyName || "closed_lost_reason",
    );
  });

// Busca no HubSpot o motivo de perda dos deals locais marcados como
// perdidos que estejam sem motivo registrado e atualiza no banco.
export const backfillLostDealReasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyName?: string } | undefined) =>
    z
      .object({ propertyName: z.string().trim().min(1).optional() })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
    if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
      throw new Error("Conecte o HubSpot para sincronizar os negócios.");
    }
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const propertyName = data?.propertyName || "closed_lost_reason";

    const { data: rows, error } = await context.supabase
      .from("deals")
      .select("id, hs_object_id")
      .eq("workspace_id", workspaceId)
      .eq("stage", "lost")
      .or("closed_lost_reason.is.null,closed_lost_reason.eq.")
      .not("hs_object_id", "is", null);
    if (error) throw new Error(error.message);

    const candidates = (rows ?? []) as Array<{ id: string; hs_object_id: string | number }>;
    if (!candidates.length) return { checked: 0, updated: 0, skipped: 0 };

    let updated = 0;
    let skipped = 0;
    const chunkSize = 100;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const res = await fetch(`${GATEWAY_URL}/crm/v3/objects/deals/batch/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": HUBSPOT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: [propertyName, "closed_lost_reason"],
          inputs: chunk.map((c) => ({ id: String(c.hs_object_id) })),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HubSpot [${res.status}]: ${body.slice(0, 200)}`);
      }
      const payload = (await res.json()) as {
        results?: Array<{ id: string; properties?: Record<string, string | null> }>;
      };
      const byHsId = new Map<string, string>();
      for (const r of payload.results ?? []) {
        const v = r.properties?.[propertyName] ?? r.properties?.closed_lost_reason ?? null;
        if (v && String(v).trim()) byHsId.set(String(r.id), String(v));
      }
      for (const c of chunk) {
        const reason = byHsId.get(String(c.hs_object_id));
        if (!reason) {
          skipped += 1;
          continue;
        }
        const { error: upErr } = await context.supabase
          .from("deals")
          .update({ closed_lost_reason: reason })
          .eq("id", c.id);
        if (!upErr) updated += 1;
        else skipped += 1;
      }
    }

    return { checked: candidates.length, updated, skipped };
  });
