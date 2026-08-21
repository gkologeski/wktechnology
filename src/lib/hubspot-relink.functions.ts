// Re-vincula atividades já importadas usando associações da HubSpot.
// Lê hs_object_id das atividades locais, chama v4 batch associations
// para contacts/companies/deals/leads e atualiza apenas os FKs nulos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

function hsHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function hsPost(path: string, body: object) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`HubSpot POST [${res.status}] ${path}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function getAssocBatch(
  fromObj: string,
  fromIds: string[],
  toObj: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!fromIds.length) return out;
  const BATCH = 100;

  for (let i = 0; i < fromIds.length; i += BATCH) {
    const chunk = fromIds.slice(i, i + BATCH);
    try {
      const r = (await hsPost(`/crm/v4/associations/${fromObj}/${toObj}/batch/read`, {
        inputs: chunk.map((id) => ({ id })),
      })) as {
        results?: {
          from?: { id?: string | number };
          to?: { toObjectId?: string | number; id?: string | number }[];
        }[];
      };
      for (const row of r.results ?? []) {
        const fromId = String(row.from?.id ?? "");
        if (!fromId) continue;
        const tos = (row.to ?? []).map((t) => String(t.toObjectId ?? t.id ?? "")).filter(Boolean);
        out.set(fromId, tos);
      }
    } catch {
      // chunk falhou — segue
    }
  }
  return out;
}

const ENGAGEMENT_OBJECT: Record<string, string> = {
  note: "notes",
  task: "tasks",
  call: "calls",
  meeting: "meetings",
  email: "emails",
};

export const relinkHubspotActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      type: z.enum(["note", "task", "call", "meeting", "email"]),
      batchSize: z.number().min(10).max(500).default(200),
      afterId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const fromObj = ENGAGEMENT_OBJECT[data.type];

    // 1. Buscar atividades com hs_object_id, algum FK nulo e ainda não verificadas
    //    recentemente. Atividades verificadas nos últimos 30 dias (sem associações
    //    na HubSpot) são puladas para não reprocessar órfãs eternamente.
    const CHECK_TTL_DAYS = 30;
    const cutoff = new Date(Date.now() - CHECK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from("activities")
      .select(
        "id, hs_object_id, related_contact_id, related_company_id, related_deal_id, related_lead_id",
      )
      .eq("workspace_id", workspaceId)
      .eq("type", data.type)
      .not("hs_object_id", "is", null)
      .or(
        "related_contact_id.is.null,related_company_id.is.null,related_deal_id.is.null,related_lead_id.is.null",
      )
      .or(`relink_checked_at.is.null,relink_checked_at.lt.${cutoff}`)
      .order("id", { ascending: true })
      .limit(data.batchSize);
    if (data.afterId) q = q.gt("id", data.afterId);
    const { data: acts, error } = await q;

    if (error) throw new Error(`Erro lendo atividades: ${error.message}`);
    if (!acts || acts.length === 0) {
      return { processed: 0, updated: 0, hasMore: false, nextCursor: null as string | null };
    }

    const hsIds = acts.map((a) => a.hs_object_id!).filter(Boolean);

    // 2. Buscar associações em paralelo para os 4 tipos
    const [toContacts, toCompanies, toDeals, toLeads] = await Promise.all([
      getAssocBatch(fromObj, hsIds, "contacts"),
      getAssocBatch(fromObj, hsIds, "companies"),
      getAssocBatch(fromObj, hsIds, "deals"),
      getAssocBatch(fromObj, hsIds, "leads"),
    ]);

    // 3. Coletar todos os HS ids referenciados e mapear para locais
    const collect = (m: Map<string, string[]>) => {
      const s = new Set<string>();
      for (const arr of m.values()) for (const v of arr) s.add(v);
      return Array.from(s);
    };
    const contactHs = collect(toContacts);
    const companyHs = collect(toCompanies);
    const dealHs = collect(toDeals);
    const leadHs = collect(toLeads);

    async function loadMap(table: string, ids: string[]) {
      const out = new Map<string, string>();
      if (!ids.length) return out;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { data: rows } = await sb
          .from(table)
          .select("id, hs_object_id")
          .eq("workspace_id", workspaceId)
          .in("hs_object_id", chunk);
        for (const r of (rows ?? []) as { id: string; hs_object_id: string | null }[]) {
          if (r.hs_object_id) out.set(String(r.hs_object_id), r.id);
        }
      }
      return out;
    }

    const [contactMap, companyMap, dealMap, leadMap] = await Promise.all([
      loadMap("contacts", contactHs),
      loadMap("companies", companyHs),
      loadMap("deals", dealHs),
      loadMap("leads", leadHs),
    ]);

    // 4. Para cada atividade, montar update se algo mudou
    let updated = 0;
    const pick = (map: Map<string, string[]>, hs: string, local: Map<string, string>) => {
      const arr = map.get(hs) ?? [];
      for (const v of arr) {
        const id = local.get(v);
        if (id) return id;
      }
      return null;
    };

    for (const a of acts) {
      const hs = a.hs_object_id!;
      const patch: Record<string, string> = {};
      if (!a.related_contact_id) {
        const v = pick(toContacts, hs, contactMap);
        if (v) patch.related_contact_id = v;
      }
      if (!a.related_company_id) {
        const v = pick(toCompanies, hs, companyMap);
        if (v) patch.related_company_id = v;
      }
      if (!a.related_deal_id) {
        const v = pick(toDeals, hs, dealMap);
        if (v) patch.related_deal_id = v;
      }
      if (!a.related_lead_id) {
        const v = pick(toLeads, hs, leadMap);
        if (v) patch.related_lead_id = v;
      }
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("activities")
          .update({ ...patch, relink_checked_at: new Date().toISOString() } as never)
          .eq("id", a.id)
          .eq("workspace_id", workspaceId);
        if (!upErr) updated++;
      } else {
        // Sem associações na HubSpot — marca como verificada para não reprocessar
        await supabase
          .from("activities")
          .update({ relink_checked_at: new Date().toISOString() } as never)
          .eq("id", a.id)
          .eq("workspace_id", workspaceId);
      }
    }

    return {
      processed: acts.length,
      updated,
      hasMore: acts.length >= data.batchSize,
      nextCursor: acts[acts.length - 1].id as string,
    };
  });

export const countActivitiesToRelink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const counts: Record<string, number> = {};
    const stats: Record<string, { total: number; linked: number; pending: number }> = {};
    const CHECK_TTL_DAYS = 30;
    const cutoff = new Date(Date.now() - CHECK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    for (const t of ["note", "task", "call", "meeting", "email"] as const) {
      const base = supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("type", t)
        .not("hs_object_id", "is", null);

      const [{ count: total }, { count: pending }] = await Promise.all([
        base,
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("type", t)
          .not("hs_object_id", "is", null)
          .is("related_contact_id", null)
          .is("related_company_id", null)
          .is("related_deal_id", null)
          .is("related_lead_id", null)
          .or(`relink_checked_at.is.null,relink_checked_at.lt.${cutoff}`),
      ]);

      const totalN = total ?? 0;
      const pendingN = pending ?? 0;
      stats[t] = { total: totalN, linked: totalN - pendingN, pending: pendingN };
      counts[t] = pendingN;
    }
    return { counts, stats };
  });
