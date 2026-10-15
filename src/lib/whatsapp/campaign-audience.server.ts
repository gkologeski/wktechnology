// Carrega o público de uma campanha de WhatsApp com o cliente do usuário (RLS)
// e filtro explícito por workspace. Só lê colunas da lista branca.
import {
  fullName,
  combineAudienceGroups,
  isAllowedFilter,
  normalizeAudienceGroups,
  type AudienceBase,
  type AudienceFilter,
  type AudienceGroup,
  type AudienceRow,
} from "./campaign-audience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const MAX_AUDIENCE = 5000;

export type AudienceInput =
  | { type: "queue"; queue_id: string }
  | {
      type: "filter";
      base: AudienceBase;
      filters?: AudienceFilter[];
      groups?: AudienceGroup[];
      groups_logic?: "and" | "or";
    };

/** Teto de IDs lidos por filtro antes de combinar grupos. */
const MAX_IDS_PER_FILTER = 20000;

const clean = (v: string) => v.replace(/[%_,()*"\\]/g, " ").trim();

function applyOp(q: Db, f: AudienceFilter): Db {
  const col = f.column;
  const v = f.value.trim();
  switch (f.op) {
    case "ilike":
      return q.ilike(col, `%${clean(v)}%`);
    case "not_ilike":
      return q.or(`${col}.is.null,${col}.not.ilike.*${clean(v)}*`);
    case "neq":
      return q.or(`${col}.is.null,${col}.neq."${clean(v)}"`);
    case "is_null":
      return q.is(col, null);
    case "is_not_null":
      return q.not(col, "is", null);
    default:
      return q[f.op](col, v);
  }
}

async function fetchColumn(build: () => Db): Promise<R[]> {
  const out: R[] = [];
  for (let from = 0; from < MAX_IDS_PER_FILTER; from += 1000) {
    const { data, error } = await build()
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as R[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Como a entidade relacionada liga-se à base. */
type Link =
  | { kind: "direct"; col: string } // coluna da relacionada = id da base
  | { kind: "reverse"; col: string }; // coluna da base = id da relacionada
const LINKS: Record<AudienceBase, Partial<Record<AudienceBase, Link[]>>> = {
  contacts: {
    companies: [{ kind: "reverse", col: "company_id" }],
    deals: [{ kind: "direct", col: "primary_contact_id" }],
    leads: [{ kind: "direct", col: "converted_contact_id" }],
  },
  companies: {
    contacts: [{ kind: "direct", col: "company_id" }],
    deals: [{ kind: "direct", col: "company_id" }],
    leads: [{ kind: "direct", col: "company_id" }],
  },
  deals: {
    companies: [{ kind: "reverse", col: "company_id" }],
    contacts: [{ kind: "reverse", col: "primary_contact_id" }],
    leads: [{ kind: "direct", col: "converted_deal_id" }],
  },
  leads: {
    companies: [{ kind: "reverse", col: "company_id" }],
    contacts: [{ kind: "reverse", col: "converted_contact_id" }],
    deals: [{ kind: "reverse", col: "converted_deal_id" }],
  },
};

/** IDs da base que atendem a um filtro (próprio ou de entidade relacionada). */
async function idsForFilter(
  db: Db,
  ws: string,
  base: AudienceBase,
  f: AudienceFilter,
): Promise<Set<string>> {
  const entity = f.entity ?? base;
  const rowsOf = (t: string, cols: string) =>
    fetchColumn(() =>
      applyOp(db.from(t).select(cols).eq("workspace_id", ws).is("deleted_at", null), f),
    );
  if (entity === base) return new Set((await rowsOf(base, "id")).map((r) => r.id as string));

  const links = LINKS[base][entity] ?? [];
  const directCols = links.filter((l) => l.kind === "direct").map((l) => l.col);
  const rel = await rowsOf(entity, ["id", ...directCols].join(", "));
  const relIds = rel.map((r) => r.id as string);
  const out = new Set<string>();
  for (const l of links) {
    if (l.kind === "direct") {
      for (const r of rel) if (r[l.col]) out.add(r[l.col] as string);
    } else {
      for (const r of await fetchWhereIn(db, base, "id", l.col, relIds, ws))
        out.add(r.id as string);
    }
  }
  // Negócio ↔ contato também via deal_contacts.
  if ((base === "contacts" && entity === "deals") || (base === "deals" && entity === "contacts")) {
    const [from, to] = base === "contacts" ? ["deal_id", "contact_id"] : ["contact_id", "deal_id"];
    for (let i = 0; i < relIds.length; i += 200) {
      const { data, error } = await db
        .from("deal_contacts")
        .select(to)
        .in(from, relIds.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as R[]) if (r[to]) out.add(r[to] as string);
    }
  }
  return out;
}

const SELECT: Record<AudienceBase, string> = {
  leads:
    "id, first_name, last_name, email, phone, mobile_phone, company_name, source, status, company_id, assigned_to, converted_contact_id, converted_deal_id, created_at",
  contacts:
    "id, first_name, last_name, email, phone, mobile_phone, job_title, city, state, company_id, assigned_to, created_at",
  companies: "id, name, industry, city, state, website, phone, assigned_to",
  deals:
    "id, name, service_line, source, stage, value, company_id, primary_contact_id, assigned_to, created_at, closed_at",
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

/** Lê registros onde `col` está em `ids` (workspace ativo, não excluídos). */
async function fetchWhereIn(
  db: Db,
  table: string,
  cols: string,
  col: string,
  ids: string[],
  ws: string,
  openDealsOnly = false,
) {
  const out: R[] = [];
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 200) {
    let q = db
      .from(table)
      .select(cols)
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .in(col, uniq.slice(i, i + 200));
    if (openDealsOnly) q = q.is("closed_at", null);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as R[]));
  }
  return out;
}

/** Primeiro registro (mais recente) por valor de `key`. */
function firstBy(rows: R[], key: string, pred: (r: R) => boolean = () => true) {
  const m = new Map<string, R>();
  for (const r of rows) {
    const k = r[key];
    if (k && !m.has(k) && pred(r)) m.set(k, r);
  }
  return m;
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
  senderId?: string,
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
    const fBase = base;
    const groups = normalizeAudienceGroups(audience);
    if (groups.length > 10 || groups.some((g) => g.filters.length > 20))
      throw new Error("Público com grupos ou filtros demais.");
    if (groups.some((g) => g.filters.some((f) => !isAllowedFilter(fBase, f))))
      throw new Error("Filtro não permitido.");
    if (groups.length === 0) {
      raw = await fetchPaged(() =>
        db.from(fBase).select(SELECT[fBase]).eq("workspace_id", workspaceId).is("deleted_at", null),
      );
    } else {
      const ids = await combineAudienceGroups(
        groups,
        (f) => idsForFilter(db, workspaceId, fBase, f),
        audience.groups_logic === "and" ? "and" : "or",
      );
      raw = await fetchByIds(
        db,
        fBase,
        SELECT[fBase],
        [...ids].sort().slice(0, MAX_AUDIENCE + 1),
        workspaceId,
      );
    }
  }
  const truncated = raw.length > MAX_AUDIENCE;
  raw = raw.slice(0, MAX_AUDIENCE);

  // Registros relacionados, lidos em lote (todas as entidades para qualquer base).
  const ids = (k: string) => raw.map((r) => r[k]).filter(Boolean) as string[];
  const selfIds = ids("id");

  // Contatos
  let contactIds: string[] = [];
  if (base === "leads") contactIds = ids("converted_contact_id");
  if (base === "deals") contactIds = ids("primary_contact_id");
  const contacts = new Map(
    (await fetchByIds(db, "contacts", SELECT.contacts, contactIds, workspaceId)).map((c) => [
      c.id as string,
      c,
    ]),
  );
  const companyContacts =
    base === "companies"
      ? firstBy(
          await fetchWhereIn(db, "contacts", SELECT.contacts, "company_id", selfIds, workspaceId),
          "company_id",
          (c) => !!(c.mobile_phone || c.phone),
        )
      : new Map<string, R>();

  // Negócios
  const dealById =
    base === "leads"
      ? new Map(
          (await fetchByIds(db, "deals", SELECT.deals, ids("converted_deal_id"), workspaceId)).map(
            (d) => [d.id as string, d],
          ),
        )
      : new Map<string, R>();
  const dealsByContact =
    base === "contacts"
      ? firstBy(
          await fetchWhereIn(
            db,
            "deals",
            SELECT.deals,
            "primary_contact_id",
            selfIds,
            workspaceId,
            true,
          ),
          "primary_contact_id",
        )
      : new Map<string, R>();
  const dealsByCompany =
    base === "companies"
      ? firstBy(
          await fetchWhereIn(db, "deals", SELECT.deals, "company_id", selfIds, workspaceId, true),
          "company_id",
        )
      : new Map<string, R>();

  // Empresas
  const relatedContacts = [...contacts.values(), ...companyContacts.values()];
  const companyIds =
    base === "companies"
      ? []
      : [...ids("company_id"), ...relatedContacts.map((c) => c.company_id!)];
  const companies = new Map(
    (await fetchByIds(db, "companies", SELECT.companies, companyIds, workspaceId)).map((c) => [
      c.id as string,
      c,
    ]),
  );

  // Leads (convertidos no contato), quando a base não é de leads
  const contactKeys =
    base === "contacts" ? selfIds : [...contacts.keys(), ...relatedContacts.map((c) => c.id!)];
  const leadsByContact =
    base === "leads"
      ? new Map<string, R>()
      : firstBy(
          await fetchWhereIn(
            db,
            "leads",
            SELECT.leads,
            "converted_contact_id",
            contactKeys,
            workspaceId,
          ),
          "converted_contact_id",
        );

  // Responsáveis e remetente (nome do perfil)
  const allRecords = [
    ...raw,
    ...contacts.values(),
    ...companyContacts.values(),
    ...companies.values(),
    ...dealById.values(),
    ...dealsByContact.values(),
    ...dealsByCompany.values(),
  ];
  const userIds = [
    ...new Set([...allRecords.map((r) => r.assigned_to), senderId].filter(Boolean) as string[]),
  ];
  const people = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as R[]) if (p.full_name) people.set(p.id!, p.full_name);
  }
  const owner = (group: string, uid?: string | null) => {
    const n = uid ? people.get(uid) : undefined;
    return {
      [`${group}.full_name`]: n,
      [`${group}.first_name`]: n?.split(/\s+/)[0],
    };
  };

  const leadValues = (l?: R) => ({
    "lead.first_name": l?.first_name,
    "lead.last_name": l?.last_name,
    "lead.full_name": l ? fullName(l.first_name, l.last_name) : null,
    "lead.email": l?.email,
    "lead.company_name": l?.company_name,
    "lead.source": l?.source,
    "lead.status": l?.status ? (LEAD_STATUS[l.status] ?? l.status) : null,
  });
  const companyValues = (c?: R) => ({
    "company.name": c?.name,
    "company.industry": c?.industry,
    "company.city": c?.city,
    "company.state": c?.state,
    "company.website": c?.website,
    ...owner("owner_company", c?.assigned_to),
  });
  const contactValues = (c?: R) => ({
    "contact.first_name": c?.first_name,
    "contact.last_name": c?.last_name,
    "contact.full_name": c ? fullName(c.first_name, c.last_name) : null,
    "contact.email": c?.email,
    "contact.job_title": c?.job_title,
    "contact.city": c?.city,
    "contact.state": c?.state,
    ...owner("owner_contact", c?.assigned_to),
  });
  const dealValues = (d?: R) => ({
    "deal.name": d?.name,
    "deal.service_line": d?.service_line,
    "deal.source": d?.source,
    "deal.stage": d?.stage ? (DEAL_STAGE[d.stage] ?? d.stage) : null,
    "deal.value": d?.value != null && d.value !== "" ? formatBRL(d.value) : null,
    ...owner("owner_deal", d?.assigned_to),
  });
  const common = (r: R) => ({
    ...owner("owner_record", r.assigned_to),
    ...owner("sender", senderId),
  });

  const rows: AudienceRow[] = raw.map((r) => {
    if (base === "leads") {
      const contact = r.converted_contact_id ? contacts.get(r.converted_contact_id) : undefined;
      const company = companies.get((r.company_id || contact?.company_id) ?? "");
      return {
        sourceType: "lead",
        sourceId: r.id!,
        contactId: contact?.id ?? null,
        phone: r.mobile_phone || r.phone,
        label: fullName(r.first_name, r.last_name) || r.email || "Lead",
        values: {
          ...contactValues(contact),
          ...companyValues(company),
          ...dealValues(r.converted_deal_id ? dealById.get(r.converted_deal_id) : undefined),
          ...leadValues(r),
          ...common(r),
        },
      };
    }
    if (base === "contacts") {
      const company = r.company_id ? companies.get(r.company_id) : undefined;
      return {
        sourceType: "contact",
        sourceId: r.id!,
        contactId: r.id!,
        phone: r.mobile_phone || r.phone,
        label: fullName(r.first_name, r.last_name) || r.email || "Contato",
        values: {
          ...leadValues(leadsByContact.get(r.id!)),
          ...companyValues(company),
          ...dealValues(dealsByContact.get(r.id!)),
          ...contactValues(r),
          ...common(r),
        },
      };
    }
    if (base === "companies") {
      const contact = companyContacts.get(r.id!);
      return {
        sourceType: "company",
        sourceId: r.id!,
        contactId: null,
        phone: r.phone,
        label: r.name || "Empresa",
        values: {
          ...leadValues(contact ? leadsByContact.get(contact.id!) : undefined),
          ...contactValues(contact),
          ...dealValues(dealsByCompany.get(r.id!)),
          ...companyValues(r),
          ...common(r),
        },
      };
    }
    const contact = r.primary_contact_id ? contacts.get(r.primary_contact_id) : undefined;
    const company = companies.get((r.company_id || contact?.company_id) ?? "");
    return {
      sourceType: "deal",
      sourceId: r.id!,
      contactId: contact?.id ?? null,
      phone: contact ? contact.mobile_phone || contact.phone : null,
      label: r.name || "Negócio",
      values: {
        ...leadValues(contact ? leadsByContact.get(contact.id!) : undefined),
        ...contactValues(contact),
        ...companyValues(company),
        ...dealValues(r),
        ...common(r),
      },
    };
  });
  return { base, rows, truncated };
}

const LEAD_STATUS: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  nurturing: "Em nutrição",
};
const DEAL_STAGE: Record<string, string> = {
  new: "Novo",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};
function formatBRL(v: string | number): string {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : String(v);
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
