// Two-way sync HubSpot: push local contacts → HubSpot e pull contacts → local com mapping.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

function hsHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function hsRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...hsHeaders(), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const txt = await res.text();
  let data: unknown = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }
  if (!res.ok)
    throw new Error(
      `HubSpot [${res.status}] ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  return data as Record<string, unknown>;
}

export const pushContactsToHubspot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) =>
    z.object({ limit: z.number().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: mapped } = await supabase
      .from("hubspot_sync_state")
      .select("local_id")
      .eq("workspace_id", workspaceId)
      .eq("entity", "contact");
    const mappedIds = new Set((mapped ?? []).map((m) => m.local_id as string));

    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company_name")
      .eq("workspace_id", workspaceId)
      .limit(data.limit);

    let pushed = 0;
    let updated = 0;
    let failed = 0;
    for (const c of contacts ?? []) {
      try {
        const props = {
          firstname: c.first_name as string,
          lastname: (c.last_name as string | null) ?? "",
          email: (c.email as string | null) ?? undefined,
          phone: (c.phone as string | null) ?? undefined,
          company: (c.company_name as string | null) ?? undefined,
        };
        if (mappedIds.has(c.id as string)) {
          const { data: m } = await supabase
            .from("hubspot_sync_state")
            .select("hubspot_id")
            .eq("workspace_id", workspaceId)
            .eq("entity", "contact")
            .eq("local_id", c.id as string)
            .maybeSingle();
          if (m?.hubspot_id) {
            await hsRequest(`/crm/v3/objects/contacts/${m.hubspot_id}`, {
              method: "PATCH",
              body: JSON.stringify({ properties: props }),
            });
            updated++;
          }
        } else {
          const r = await hsRequest(`/crm/v3/objects/contacts`, {
            method: "POST",
            body: JSON.stringify({ properties: props }),
          });
          await supabase.from("hubspot_sync_state").insert({
            owner_id: userId,
            workspace_id: workspaceId,
            entity: "contact",
            local_id: c.id as string,
            hubspot_id: r.id as string,
            direction: "both",
          });
          pushed++;
        }
      } catch {
        failed++;
      }
    }
    return { pushed, updated, failed };
  });

export const listHubspotSyncState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("hubspot_sync_state")
      .select("id, entity, local_id, hubspot_id, last_synced_at, direction")
      .eq("workspace_id", workspaceId)
      .order("last_synced_at", { ascending: false })
      .limit(200);
    return { state: data ?? [] };
  });
