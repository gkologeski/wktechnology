// Reconcilia entidades (contacts/companies/deals/leads) entre HubSpot e o sistema.
// Lista IDs no HubSpot (mais recentes primeiro), descobre quais não existem
// localmente e importa os faltantes. Não toca em registros já presentes.
// Associações ficam para o fluxo de "Re-vincular" (quando aplicável).
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

type EntityKind = "contact" | "company" | "deal" | "lead" | "ticket";

const ENTITY_TO_OBJECT: Record<EntityKind, string> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
  lead: "leads",
  ticket: "tickets",
};

const ENTITY_TO_TABLE: Record<
  EntityKind,
  "contacts" | "companies" | "deals" | "leads" | "tickets"
> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
  lead: "leads",
  ticket: "tickets",
};

const PROPS_BY_ENTITY: Record<EntityKind, string[]> = {
  contact: [
    "firstname",
    "lastname",
    "email",
    "phone",
    "jobtitle",
    "mobilephone",
    "country",
    "address",
    "zip",
    "city",
    "state",
    "website",
    "company",
    "lifecyclestage",
    "hs_lead_status",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "hs_createdate",
    "lastmodifieddate",
    "hs_lastmodifieddate",
    "linkedin_url",
    "linkedinbio",
    "twitterhandle",
  ],
  company: [
    "name",
    "domain",
    "industry",
    "numberofemployees",
    "phone",
    "city",
    "state",
    "zip",
    "address",
    "website",
    "annualrevenue",
    "lifecyclestage",
    "hs_lead_status",
    "description",
    "country",
    "timezone",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "hs_createdate",
    "lastmodifieddate",
    "hs_lastmodifieddate",
    "type",
    "linkedin_company_page",
    "twitterhandle",
    "facebook_company_page",
  ],
  deal: [
    "dealname",
    "amount",
    "dealstage",
    "closedate",
    "pipeline",
    "description",
    "dealtype",
    "hs_priority",
    "hs_deal_stage_probability",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "hs_createdate",
    "hs_lastmodifieddate",
    "closed_lost_reason",
    "closed_won_reason",
    "num_associated_contacts",
  ],
  lead: [
    "hs_lead_name",
    "hs_lead_name_calculated",
    "hs_associated_contact_firstname",
    "hs_associated_contact_lastname",
    "hs_associated_contact_email",
    "hs_associated_company_name",
    "hs_lead_source",
    "hs_analytics_source",
    "hs_analytics_source_data_1",
    "hs_pipeline_stage",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "lastmodifieddate",
    "hs_lastmodifieddate",
  ],
  ticket: [
    "subject",
    "content",
    "hs_pipeline",
    "hs_pipeline_stage",
    "hs_ticket_priority",
    "hs_ticket_category",
    "source_type",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "hs_createdate",
    "hs_lastmodifieddate",
    "closed_date",
    "time_to_close",
    "hs_resolution",
  ],
};

function parseHsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? new Date(n).toISOString() : null;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function parseHsNum(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type HsProps = Record<string, string | null | undefined>;
type HsRec = { id: string; properties: HsProps; createdAt?: string; updatedAt?: string };
type SearchCursor = { after?: string; before?: string };

function parseCursor(raw: string | undefined): SearchCursor {
  if (!raw) return {};
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SearchCursor;
    return { after: decoded.after, before: decoded.before };
  } catch {
    if (/^\d+$/.test(raw) && Number(raw) < 10000) return { after: raw };
    return {};
  }
}
function encodeCursor(cursor: SearchCursor): string | undefined {
  if (!cursor.after && !cursor.before) return undefined;
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
function hsSearchDateValue(value: string | undefined): string | undefined {
  const iso = parseHsDate(value);
  if (!iso) return undefined;
  return String(new Date(iso).getTime());
}

function rawOf(rec: HsRec) {
  return {
    id: rec.id,
    properties: rec.properties,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  } as never;
}

function originalCreatedAt(rec: HsRec): Record<string, string> {
  const createdAt = parseHsDate(
    rec.properties.createdate ?? rec.properties.hs_createdate ?? rec.createdAt,
  );
  return createdAt ? { created_at: createdAt } : {};
}

function buildPayload(
  entity: EntityKind,
  ownerId: string,
  rec: HsRec,
): Record<string, unknown> | null {
  const p = rec.properties;
  if (entity === "company") {
    if (!p.name) return null;
    return {
      owner_id: ownerId,
      name: p.name,
      domain: p.domain ?? null,
      industry: p.industry ?? null,
      size: p.numberofemployees ?? null,
      phone: p.phone ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      cep: p.zip ?? null,
      address: p.address ?? null,
      website: p.website ?? null,
      annualrevenue: parseHsNum(p.annualrevenue),
      lifecyclestage: p.lifecyclestage ?? null,
      hs_lead_status: p.hs_lead_status ?? null,
      description: p.description ?? null,
      country: p.country ?? null,
      timezone: p.timezone ?? null,
      hubspot_owner_id: p.hubspot_owner_id ?? null,
      hs_object_id: p.hs_object_id ?? rec.id,
      hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
      ...originalCreatedAt(rec),
      hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate ?? p.lastmodifieddate),
      type: p.type ?? null,
      linkedin_company_page: p.linkedin_company_page ?? null,
      twitterhandle: p.twitterhandle ?? null,
      facebook_company_page: p.facebook_company_page ?? null,
      external_ids: { hubspot: rec.id } as never,
      hs_raw: rawOf(rec),
    };
  }
  if (entity === "contact") {
    if (!p.firstname && !p.email) return null;
    return {
      owner_id: ownerId,
      first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
      last_name: p.lastname ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      job_title: p.jobtitle ?? null,
      mobile_phone: p.mobilephone ?? null,
      country: p.country ?? null,
      address: p.address ?? null,
      cep: p.zip ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      website: p.website ?? null,
      company_name: p.company ?? null,
      lifecyclestage: p.lifecyclestage ?? null,
      hs_lead_status: p.hs_lead_status ?? null,
      hubspot_owner_id: p.hubspot_owner_id ?? null,
      hs_object_id: p.hs_object_id ?? rec.id,
      hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
      ...originalCreatedAt(rec),
      hs_lastmodifieddate: parseHsDate(p.lastmodifieddate ?? p.hs_lastmodifieddate),
      linkedin_url: p.linkedin_url ?? p.linkedinbio ?? null,
      twitter_handle: p.twitterhandle ?? null,
      external_ids: { hubspot: rec.id, hs_lifecyclestage: p.lifecyclestage ?? null } as never,
      hs_raw: rawOf(rec),
    };
  }
  if (entity === "deal") {
    return {
      owner_id: ownerId,
      name: p.dealname ?? "Sem nome",
      value: p.amount ? Number(p.amount) : 0,
      currency: "BRL",
      stage: "new",
      stage_id: p.dealstage ?? null,
      pipeline_id: null,
      company_id: null,
      expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
      description: p.description ?? null,
      dealtype: p.dealtype ?? null,
      hs_priority: p.hs_priority ?? null,
      hs_deal_stage_probability: parseHsNum(p.hs_deal_stage_probability),
      hubspot_owner_id: p.hubspot_owner_id ?? null,
      hs_object_id: p.hs_object_id ?? rec.id,
      hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
      ...originalCreatedAt(rec),
      hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate),
      closed_lost_reason: p.closed_lost_reason ?? null,
      closed_won_reason: p.closed_won_reason ?? null,
      num_associated_contacts:
        parseHsNum(p.num_associated_contacts) !== null
          ? Math.trunc(parseHsNum(p.num_associated_contacts) as number)
          : null,
      external_ids: {
        hubspot: rec.id,
        hs_stage: p.dealstage ?? null,
        hs_pipeline: p.pipeline ?? null,
      } as never,
      hs_raw: rawOf(rec),
    };
  }
  // lead
  let first = (p.hs_associated_contact_firstname ?? "") as string;
  let last = (p.hs_associated_contact_lastname ?? null) as string | null;
  if (!first) {
    const full = ((p.hs_lead_name_calculated ?? p.hs_lead_name ?? "") as string).trim();
    if (full) {
      const parts = full.split(/\s+/);
      first = parts[0];
      last = parts.slice(1).join(" ") || last;
    }
  }
  if (!first) first = (p.hs_associated_contact_email ?? "Sem nome") as string;
  return {
    owner_id: ownerId,
    first_name: first,
    last_name: last,
    email: p.hs_associated_contact_email ?? null,
    phone: null,
    company_name: p.hs_associated_company_name ?? null,
    source: p.hs_lead_source ?? p.hs_analytics_source ?? "hubspot",
    status: "new",
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? rec.id,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    ...originalCreatedAt(rec),
    hs_lastmodifieddate: parseHsDate(p.lastmodifieddate ?? p.hs_lastmodifieddate),
    hs_lead_source_detail: p.hs_analytics_source_data_1 ?? p.hs_analytics_source ?? null,
    external_ids: { hubspot: rec.id } as never,
    hs_raw: rawOf(rec),
  };
}

function buildTicketPayload(ownerId: string, rec: HsRec): Record<string, unknown> | null {
  const p = rec.properties;
  const subject = (p.subject ?? `Ticket ${rec.id}`) as string;
  const prMap: Record<string, string> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    URGENT: "urgent",
  };
  const priority = prMap[(p.hs_ticket_priority ?? "").toUpperCase()] ?? "medium";
  // status mapping fica simplificado; o importador completo já mapeia via pipelines.
  const closed = !!p.closed_date;
  const status = closed ? "closed" : "open";
  return {
    owner_id: ownerId,
    subject,
    description: p.content ?? null,
    status,
    priority,
    source: p.source_type ?? "hubspot",
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? rec.id,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    ...originalCreatedAt(rec),
    hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate),
    resolved_at: parseHsDate(p.closed_date),
    external_ids: {
      hubspot: rec.id,
      hs_pipeline: p.hs_pipeline ?? null,
      hs_pipeline_stage: p.hs_pipeline_stage ?? null,
    } as never,
    hs_raw: rawOf(rec),
  };
}

export const reconcileHubspotEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entity: z.enum(["contact", "company", "deal", "lead", "ticket"]),
      after: z.string().optional(),
      pages: z.number().min(1).max(5).default(3),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const entity = data.entity as EntityKind;
    const obj = ENTITY_TO_OBJECT[entity];
    const table = ENTITY_TO_TABLE[entity];

    let cursor = parseCursor(data.after);
    let scanned = 0;
    let missingCount = 0;
    let imported = 0;
    let failed = 0;

    const tsProp = entity === "contact" ? "lastmodifieddate" : "hs_lastmodifieddate";

    for (let page = 0; page < data.pages; page++) {
      const filters = [{ propertyName: tsProp, operator: "GTE", value: "0" }] as Record<
        string,
        string
      >[];
      const beforeValue = hsSearchDateValue(cursor.before);
      if (beforeValue) filters.push({ propertyName: tsProp, operator: "LT", value: beforeValue });

      const searchBody: Record<string, unknown> = {
        limit: 100,
        properties: ["hs_object_id", tsProp],
        sorts: [{ propertyName: tsProp, direction: "DESCENDING" }],
        filterGroups: [{ filters }],
      };
      if (cursor.after) searchBody.after = cursor.after;

      const r = (await hsPost(`/crm/v3/objects/${obj}/search`, searchBody)) as {
        results?: HsRec[];
        paging?: { next?: { after?: string } };
      };

      const ids = (r.results ?? []).map((x) => x.id).filter(Boolean);
      if (ids.length === 0) {
        cursor = {};
        break;
      }
      scanned += ids.length;

      const { data: existing } = await supabase
        .from(table)
        .select("hs_object_id")
        .eq("workspace_id", workspaceId)
        .in("hs_object_id", ids);
      const have = new Set(
        ((existing ?? []) as { hs_object_id: string | null }[])
          .map((x) => x.hs_object_id)
          .filter(Boolean) as string[],
      );
      const missing = ids.filter((id) => !have.has(id));
      missingCount += missing.length;

      for (let i = 0; i < missing.length; i += 100) {
        const chunk = missing.slice(i, i + 100);
        try {
          const rd = (await hsPost(`/crm/v3/objects/${obj}/batch/read`, {
            properties: PROPS_BY_ENTITY[entity],
            inputs: chunk.map((id) => ({ id })),
          })) as { results?: HsRec[] };
          const rows: Record<string, unknown>[] = [];
          for (const rec of rd.results ?? []) {
            const payload =
              entity === "ticket"
                ? buildTicketPayload(userId, rec)
                : buildPayload(entity as Exclude<EntityKind, "ticket">, userId, rec);
            if (payload) rows.push(payload);
            else failed++;
          }
          if (rows.length) {
            const { error: insErr } = await supabase.from(table).insert(rows as never);
            if (insErr) failed += rows.length;
            else imported += rows.length;
          }
        } catch {
          failed += chunk.length;
        }
      }

      const nextAfter = r.paging?.next?.after;
      if (!nextAfter) {
        cursor = {};
        break;
      }
      if (Number(nextAfter) >= 10000) {
        const last = r.results?.at(-1);
        const before =
          last?.properties?.[tsProp] ?? last?.properties?.hs_lastmodifieddate ?? last?.updatedAt;
        cursor = before ? { before } : {};
      } else {
        cursor = { ...cursor, after: nextAfter };
      }
      if (!cursor.after && !cursor.before) break;
    }

    const nextCursor = encodeCursor(cursor);
    return {
      scanned,
      missing: missingCount,
      imported,
      failed,
      nextAfter: nextCursor ?? null,
      hasMore: !!nextCursor,
    };
  });
