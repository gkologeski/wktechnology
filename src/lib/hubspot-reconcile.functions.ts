// Reconcilia activities (notes/tasks/calls/meetings/emails) entre HubSpot e o sistema.
// Lista IDs no HubSpot (paginado, mais recentes primeiro), descobre quais não existem
// localmente e importa os faltantes. Não toca em registros já presentes.
// Associações (contact/company/deal/lead) ficam para o fluxo de "Re-vincular".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const KIND_TO_OBJECT = {
  note: "notes",
  task: "tasks",
  call: "calls",
  meeting: "meetings",
  email: "emails",
} as const;
type Kind = keyof typeof KIND_TO_OBJECT;

const PROPS_BY_KIND: Record<Kind, string[]> = {
  note: ["hs_note_body", "hs_timestamp", "hs_createdate", "hs_lastmodifieddate"],
  task: ["hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status", "hs_task_priority", "hs_createdate", "hs_lastmodifieddate"],
  call: ["hs_call_title", "hs_call_body", "hs_timestamp", "hs_call_disposition", "hs_call_duration", "hs_call_recording_url", "hs_createdate", "hs_lastmodifieddate"],
  meeting: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp", "hs_meeting_outcome", "hs_meeting_location", "hs_meeting_duration", "hs_createdate", "hs_lastmodifieddate"],
  email: ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_email_status", "hs_timestamp", "hs_createdate", "hs_lastmodifieddate"],
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

function buildPayload(kind: Kind, ownerId: string, rec: HsRec) {
  const p = rec.properties;
  const subject =
    p.hs_note_body?.replace(/<[^>]+>/g, "").slice(0, 100) ??
    p.hs_call_title ??
    p.hs_meeting_title ??
    p.hs_task_subject ??
    p.hs_email_subject ??
    kind;
  const body =
    p.hs_note_body ?? p.hs_call_body ?? p.hs_meeting_body ?? p.hs_task_body ?? p.hs_email_text ?? null;
  const due = parseHsDate(p.hs_timestamp);
  const ms = parseHsNum(p.hs_call_duration) ?? parseHsNum(p.hs_meeting_duration) ?? null;
  const hsCreated = parseHsDate(p.hs_createdate) ?? parseHsDate(p.hs_timestamp) ?? rec.createdAt ?? null;
  const hsUpdated = parseHsDate(p.hs_lastmodifieddate) ?? rec.updatedAt ?? null;
  return {
    owner_id: ownerId,
    type: kind,
    subject,
    body,
    due_date: due,
    completed: kind !== "task",
    hs_object_id: rec.id,
    hs_createdate: hsCreated,
    hs_lastmodifieddate: hsUpdated,
    duration_ms: ms !== null ? Math.trunc(ms) : null,
    disposition: p.hs_call_disposition ?? null,
    recording_url: p.hs_call_recording_url ?? null,
    meeting_outcome: p.hs_meeting_outcome ?? null,
    meeting_location: p.hs_meeting_location ?? null,
    task_status: p.hs_task_status ?? null,
    task_priority: p.hs_task_priority ?? null,
    email_direction: p.hs_email_direction ?? null,
    email_status: p.hs_email_status ?? null,
    external_ids: { hubspot: rec.id, hs_kind: KIND_TO_OBJECT[kind] } as never,
    hs_raw: { id: rec.id, properties: p, createdAt: rec.createdAt, updatedAt: rec.updatedAt } as never,
    ...(hsCreated ? { created_at: hsCreated } : {}),
    ...(hsUpdated ? { updated_at: hsUpdated } : {}),
  };
}

export const reconcileHubspotActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      type: z.enum(["note", "task", "call", "meeting", "email"]),
      after: z.string().optional(),
      pages: z.number().min(1).max(5).default(3),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const kind = data.type as Kind;
    const obj = KIND_TO_OBJECT[kind];

    let after = data.after;
    let scanned = 0;
    let missingCount = 0;
    let imported = 0;
    let failed = 0;

    for (let page = 0; page < data.pages; page++) {
      const searchBody: Record<string, unknown> = {
        limit: 100,
        properties: ["hs_object_id"],
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
        filterGroups: [],
      };
      if (after) searchBody.after = after;

      const r = (await hsPost(`/crm/v3/objects/${obj}/search`, searchBody)) as {
        results?: { id: string }[];
        paging?: { next?: { after?: string } };
      };
      const ids = (r.results ?? []).map((x) => x.id).filter(Boolean);
      if (ids.length === 0) {
        after = undefined;
        break;
      }
      scanned += ids.length;

      const { data: existing } = await supabase
        .from("activities")
        .select("hs_object_id")
        .eq("owner_id", userId)
        .eq("type", kind)
        .in("hs_object_id", ids);
      const have = new Set((existing ?? []).map((x) => x.hs_object_id as string));
      const missing = ids.filter((id) => !have.has(id));
      missingCount += missing.length;

      for (let i = 0; i < missing.length; i += 100) {
        const chunk = missing.slice(i, i + 100);
        try {
          const rd = (await hsPost(`/crm/v3/objects/${obj}/batch/read`, {
            properties: PROPS_BY_KIND[kind],
            inputs: chunk.map((id) => ({ id })),
          })) as { results?: HsRec[] };
          const rows = (rd.results ?? []).map((rec) => buildPayload(kind, userId, rec));
          if (rows.length) {
            const { error: insErr } = await supabase.from("activities").insert(rows as never);
            if (insErr) failed += rows.length;
            else imported += rows.length;
          }
        } catch {
          failed += chunk.length;
        }
      }

      after = r.paging?.next?.after;
      if (!after) break;
    }

    return {
      scanned,
      missing: missingCount,
      imported,
      failed,
      nextAfter: after ?? null,
      hasMore: !!after,
    };
  });
