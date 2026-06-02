// Sincroniza owners do HubSpot para a tabela local hubspot_owners.
// NÃO cria usuários em auth.users, NÃO envia convites.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

type HSOwner = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: string | number | null;
  teamId?: string | null;
  archived?: boolean;
};

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

async function fetchOwners(archived: boolean): Promise<HSOwner[]> {
  const out: HSOwner[] = [];
  let after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100", archived: String(archived) });
    if (after) params.set("after", after);
    const res = await fetch(`${GATEWAY_URL}/crm/v3/owners?${params}`, { headers: hsHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(`HubSpot owners [${res.status}]: ${JSON.stringify(data)}`);
    const page = data as { results: HSOwner[]; paging?: { next?: { after: string } } };
    out.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return out;
}

export const syncHubspotOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: wsData } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    const workspaceId = (wsData as string | null) ?? userId;

    const active = await fetchOwners(false);
    const archived = await fetchOwners(true);
    const all = [...active, ...archived];

    let upserted = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const o of all) {
      const row = {
        id: o.id,
        email: o.email ?? null,
        first_name: o.firstName ?? null,
        last_name: o.lastName ?? null,
        user_id: o.userId != null ? String(o.userId) : null,
        team_id: o.teamId ?? null,
        archived: Boolean(o.archived),
        status: o.archived ? "archived" : "active",
        workspace_id: workspaceId,
        hs_raw: o as unknown as never,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("hubspot_owners").upsert(row, { onConflict: "id" });
      if (error) {
        failed++;
        if (!firstError) firstError = error.message;
      } else {
        upserted++;
      }
    }
    if (upserted === 0 && failed > 0 && firstError) {
      throw new Error(`Falha ao salvar owners: ${firstError}`);
    }

    // auto-mapeia por email para profiles existentes (sem convidar ninguém)
    const { data: owners } = await supabase
      .from("hubspot_owners")
      .select("id, email, mapped_user_id")
      .eq("workspace_id", workspaceId);
    let autoMapped = 0;
    for (const ow of owners ?? []) {
      if (ow.mapped_user_id || !ow.email) continue;
      // tenta achar profile com o mesmo email
      // (não temos acesso direto a auth.users via RLS; usamos rpc se existir, ou ignoramos)
      // Mantemos sem auto-mapeamento aqui — feito via migração inicial.
    }

    return { upserted, total: all.length, autoMapped };
  });

const RebindSchema = z.object({
  hubspot_owner_id: z.string().min(1).max(64),
  mapped_user_id: z.string().uuid().nullable(),
});

export const setHubspotOwnerMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RebindSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles").select("active_workspace_id").eq("id", userId).maybeSingle();
    const workspaceId = (prof?.active_workspace_id as string | null) ?? userId;

    const { error } = await supabase
      .from("hubspot_owners")
      .update({ mapped_user_id: data.mapped_user_id, updated_at: new Date().toISOString() })
      .eq("id", data.hubspot_owner_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);

    // Propaga para registros existentes
    if (data.mapped_user_id) {
      const upd = { assigned_user_id: data.mapped_user_id } as never;
      for (const t of ["leads", "contacts", "companies", "deals"] as const) {
        await supabase.from(t).update(upd).eq("hubspot_owner_id", data.hubspot_owner_id);
      }
    }
    return { ok: true };
  });

export const listHubspotOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("active_workspace_id").eq("id", userId).maybeSingle();
    const workspaceId = (prof?.active_workspace_id as string | null) ?? userId;

    const { data: owners } = await supabase
      .from("hubspot_owners")
      .select("id, email, first_name, last_name, status, archived, mapped_user_id")
      .eq("workspace_id", workspaceId)
      .order("status", { ascending: true })
      .order("email", { ascending: true });

    // counts por owner (leads + contacts + companies + deals)
    const counts: Record<string, number> = {};
    for (const t of ["leads", "contacts", "companies", "deals"] as const) {
      const { data } = await supabase
        .from(t)
        .select("hubspot_owner_id")
        .not("hubspot_owner_id", "is", null)
        .limit(20000);
      for (const r of (data ?? []) as { hubspot_owner_id: string | null }[]) {
        if (!r.hubspot_owner_id) continue;
        counts[r.hubspot_owner_id] = (counts[r.hubspot_owner_id] ?? 0) + 1;
      }
    }

    return { owners: owners ?? [], counts };
  });
