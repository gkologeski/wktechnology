// Carrega o público de uma campanha de WhatsApp com o cliente do usuário (RLS)
// e filtro explícito por workspace. Só lê colunas da lista branca.
import {
  fullName,
  isAllowedFilter,
  type AudienceBase,
  type AudienceFilter,
  type AudienceRow,
} from "./campaign-audience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const MAX_AUDIENCE = 5000;

export type AudienceInput =
  | { type: "queue"; queue_id: string }
  | { type: "filter"; base: AudienceBase; filters: AudienceFilter[] };

const SELECT: Record<AudienceBase, string> = {
  leads: "id, first_name, last_name, email, phone, mobile_phone, company_name, source, company_id",
  contacts:
    "id, first_name, last_name, email, phone, mobile_phone, job_title, city, state, company_id",
  companies: "id, name, industry, city, state, website, phone",
  deals: "id, name, service_line, source, company_id, primary_contact_id",
};

type R = Record<string, string | null>;

function applyQueueFilters(q: Db, entity: string, filters: Record<string, unknown>): Db {
  if (Array.isArray(filters.status) && filters.status.length > 0)
    q = q.in("status", filters.status);
  else if (entity === "lead") q = q.not("status", "in", "(nurturing,qualified,disqualified)");
  if (Array.isArray(filters.source) && filters.source.length > 0)
    q = q.in("source", filters.source);
  if (typeof filters.owner_id === "string") q = q.eq("owner_id", filters.owner_id);
  if (typeof filters.score_min === "number" && entity === "lead")
    q = q.gte("score", filters.score_min);
  if (typeof filters.score_max === "number" && entity === "lead")
    q = q.lte("score", filters.score_max);
  if (typeof filters.search === "string" && filters.search.trim()) {
    const s = `%${filters.search.replace(/[%_,()*]/g, " ").trim()}%`;
    q =
      entity === "lead"
        ? q.or(
            `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},company_name.ilike.${s}`,
          )
        : q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
  }
  if (typeof filters.updated_after === "string") q = q.gte("updated_at", filters.updated_after);
  return q;
}

async function fetchByIds(db: Db, table: string, cols: string, ids: string[], ws: string) {
  const out: R[] = [];
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data, error } = await db
      .from(table)
      .select(cols)
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .in("id", uniq.slice(i, i + 200));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as R[]));
  }
  return out;
}

async function fetchPaged(build: () => Db): Promise<R[]> {
  const out: R[] = [];
  for (let from = 0; from <= MAX_AUDIENCE; from += 1000) {
    const { data, error } = await build()
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as R[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadAudienceRows(
  db: Db,
  workspaceId: string,
  audience: AudienceInput,
): Promise<{ base: AudienceBase; rows: AudienceRow[]; truncated: boolean }> {
  let base: AudienceBase;
  let raw: R[];
  if (audience.type === "queue") {
    const { data: queue, error } = await db
      .from("prospecting_queues")
      .select("entity, kind, item_ids, filters")
      .eq("id", audience.queue_id)
      // Filas antigas não têm workspace (visíveis só ao dono pela RLS); os
      // registros lidos abaixo continuam filtrados pelo workspace ativo.
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!queue) throw new Error("Fila de prospecção não encontrada.");
    base = queue.entity === "lead" ? "leads" : "contacts";
    if (queue.kind === "manual") {
      raw = await fetchByIds(
        db,
        base,
        SELECT[base],
        (queue.item_ids ?? []).slice(0, MAX_AUDIENCE + 1),
        workspaceId,
      );
    } else {
      raw = await fetchPaged(() =>
        applyQueueFilters(
          db.from(base).select(SELECT[base]).eq("workspace_id", workspaceId).is("deleted_at", null),
          queue.entity,
          (queue.filters ?? {}) as Record<string, unknown>,
        ),
      );
    }
  } else {
    base = audience.base;
    const filters = audience.filters.filter((f) => isAllowedFilter(base, f));
    if (filters.length !== audience.filters.length) throw new Error("Filtro não permitido.");
    raw = await fetchPaged(() => {
      let q = db
        .from(base)
        .select(SELECT[base])
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      for (const f of filters) {
        if (f.op === "ilike") q = q.ilike(f.column, `%${f.value.replace(/[%_]/g, " ").trim()}%`);
        else q = q[f.op](f.column, f.value);
      }
      return q;
    });
  }
  const truncated = raw.length > MAX_AUDIENCE;
  raw = raw.slice(0, MAX_AUDIENCE);

  // Registros relacionados (empresa e contato principal), lidos em lote.
  const companyIds = raw.map((r) => r.company_id).filter(Boolean) as string[];
  const contactIds =
    base === "deals" ? (raw.map((r) => r.primary_contact_id).filter(Boolean) as string[]) : [];
  const companies = new Map(
    (base === "companies"
      ? []
      : await fetchByIds(db, "companies", SELECT.companies, companyIds, workspaceId)
    ).map((c) => [c.id as string, c]),
  );
  const contacts = new Map(
    (await fetchByIds(db, "contacts", SELECT.contacts, contactIds, workspaceId)).map((c) => [
      c.id as string,
      c,
    ]),
  );

  const companyValues = (c?: R) => ({
    "company.name": c?.name,
    "company.industry": c?.industry,
    "company.city": c?.city,
    "company.state": c?.state,
    "company.website": c?.website,
  });
  const contactValues = (c?: R) => ({
    "contact.first_name": c?.first_name,
    "contact.last_name": c?.last_name,
    "contact.full_name": c ? fullName(c.first_name, c.last_name) : null,
    "contact.email": c?.email,
    "contact.job_title": c?.job_title,
    "contact.city": c?.city,
    "contact.state": c?.state,
  });

  const rows: AudienceRow[] = raw.map((r) => {
    const company = r.company_id ? companies.get(r.company_id) : undefined;
    if (base === "leads")
      return {
        sourceType: "lead",
        sourceId: r.id!,
        contactId: null,
        phone: r.mobile_phone || r.phone,
        label: fullName(r.first_name, r.last_name) || r.email || "Lead",
        values: {
          "lead.first_name": r.first_name,
          "lead.last_name": r.last_name,
          "lead.full_name": fullName(r.first_name, r.last_name),
          "lead.email": r.email,
          "lead.company_name": r.company_name,
          "lead.source": r.source,
          ...companyValues(company),
        },
      };
    if (base === "contacts")
      return {
        sourceType: "contact",
        sourceId: r.id!,
        contactId: r.id!,
        phone: r.mobile_phone || r.phone,
        label: fullName(r.first_name, r.last_name) || r.email || "Contato",
        values: { ...contactValues(r), ...companyValues(company) },
      };
    if (base === "companies")
      return {
        sourceType: "company",
        sourceId: r.id!,
        contactId: null,
        phone: r.phone,
        label: r.name || "Empresa",
        values: companyValues(r),
      };
    const contact = r.primary_contact_id ? contacts.get(r.primary_contact_id) : undefined;
    return {
      sourceType: "deal",
      sourceId: r.id!,
      contactId: contact?.id ?? null,
      phone: contact ? contact.mobile_phone || contact.phone : null,
      label: r.name || "Negócio",
      values: {
        "deal.name": r.name,
        "deal.service_line": r.service_line,
        "deal.source": r.source,
        ...contactValues(contact),
        ...companyValues(company),
      },
    };
  });
  return { base, rows, truncated };
}

/** Telefones que pediram para não receber mensagens (opt-out do SDR) no workspace. */
export async function loadOptedOutPhones(db: Db, workspaceId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("sdr_enrollments")
    .select("contact_phone")
    .eq("workspace_id", workspaceId)
    .not("opted_out_at", "is", null)
    .limit(10000);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as R[]).map((r) => r.contact_phone).filter(Boolean) as string[]);
}
