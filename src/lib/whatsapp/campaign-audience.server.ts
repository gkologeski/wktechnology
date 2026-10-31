import { pickWhatsAppNumber } from "@/lib/phone/whatsapp-e164";
// Carrega o público de uma campanha de WhatsApp com o cliente do usuário (RLS)
// e filtro explícito por workspace. Só lê colunas da lista branca.
import {
  fullName,
  compileAudienceGroups,
  isAllowedFilter,
  normalizeAudienceGroups,
  buildFilterFields,
  catalogTypeFromDataType,
  type FilterFieldCatalog,
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

/** Leituras em lote simultâneas (o runtime aceita até 6 conexões por chamada). */
const POOL = 6;

/** Executa `fn` para cada lote com até POOL simultâneos, devolvendo na ordem dos lotes. */
async function inPool<T, U>(items: T[], fn: (item: T) => Promise<U>): Promise<U[]> {
  const out = new Array<U>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(POOL, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const chunk = <T>(xs: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
};

/**
 * Lista de filtros aceitos no servidor: fixos + colunas reais da tabela (tipo do banco)
 * + campos personalizados ativos do workspace. RLS continua valendo na consulta.
 */
export async function loadServerFilterFields(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<FilterFieldCatalog> {
  const { REF_COLUMNS } = await import("@/lib/entity-fields-refs");
  const entities: AudienceBase[] = ["leads", "contacts", "companies", "deals"];
  const { data: cps } = await db
    .from("custom_properties")
    .select("entity, key, label")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true)
    .in("entity", entities);
  const out = {} as FilterFieldCatalog;
  await Promise.all(
    entities.map(async (e) => {
      const { data, error } = await db.rpc("get_entity_field_catalog", {
        p_table: e,
        p_owner_id: userId,
      });
      if (error) throw new Error(error.message);
      const catalog = ((data ?? []) as { column_name: string; data_type: string }[]).map((r) => ({
        name: r.column_name,
        label: r.column_name,
        type: catalogTypeFromDataType(r.data_type),
        ref: (REF_COLUMNS as Record<string, string | undefined>)[r.column_name],
      }));
      const custom = ((cps ?? []) as { entity: string; key: string; label: string }[])
        .filter((c) => c.entity === e)
        .map((c) => ({ key: c.key, label: c.label }));
      out[e] = buildFilterFields(e, catalog, custom);
    }),
  );
  return out;
}

/**
 * IDs da base que atendem aos grupos, resolvidos numa única consulta no banco
 * (`wa_campaign_audience_ids`, SECURITY INVOKER: RLS e grants por coluna do usuário).
 */
async function audienceIds(
  db: Db,
  ws: string,
  base: AudienceBase,
  groups: AudienceGroup[],
  logic: "and" | "or",
): Promise<string[]> {
  const { data, error } = await db.rpc("wa_campaign_audience_ids", {
    p_workspace: ws,
    p_base: base,
    p_groups: compileAudienceGroups(base, groups),
    p_groups_logic: logic,
    p_limit: MAX_AUDIENCE + 1,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as string[];
}

const SELECT: Record<AudienceBase, string> = {
  leads:
    "id, first_name, last_name, email, phone, mobile_phone, whatsapp_e164, job_title, cargo_resumido, area_atuacao, nivel_hierarquico, company_name, source, status, company_id, assigned_to, converted_contact_id, converted_deal_id, created_at",
  contacts:
    "id, first_name, last_name, email, phone, mobile_phone, whatsapp_e164, job_title, cargo_resumido, area_atuacao, nivel_hierarquico, city, state, company_id, assigned_to, created_at",
  companies: "id, name, industry, size_description, city, state, website, phone, assigned_to",
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
  const uniq = [...new Set(ids.filter(Boolean))];
  const parts = await inPool(chunk(uniq), async (part) => {
    const { data, error } = await db
      .from(table)
      .select(cols)
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .in("id", part);
    if (error) throw new Error(error.message);
    return (data ?? []) as R[];
  });
  return parts.flat();
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
  const uniq = [...new Set(ids.filter(Boolean))];
  // Lotes pela própria chave: a ordem (mais recente primeiro) por chave é preservada.
  const parts = await inPool(chunk(uniq), async (part) => {
    let q = db
      .from(table)
      .select(cols)
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .in(col, part);
    if (openDealsOnly) q = q.is("closed_at", null);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as R[];
  });
  return parts.flat();
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
    const allowed =
      groups.length && senderId
        ? await loadServerFilterFields(db, workspaceId, senderId)
        : undefined;
    if (groups.some((g) => g.filters.some((f) => !isAllowedFilter(fBase, f, allowed))))
      throw new Error("Filtro não permitido.");
    if (groups.length === 0) {
      raw = await fetchPaged(() =>
        db.from(fBase).select(SELECT[fBase]).eq("workspace_id", workspaceId).is("deleted_at", null),
      );
    } else {
      const ids = await audienceIds(
        db,
        workspaceId,
        fBase,
        groups,
        audience.groups_logic === "and" ? "and" : "or",
      );
      raw = await fetchByIds(db, fBase, SELECT[fBase], ids, workspaceId);
    }
  }
  const truncated = raw.length > MAX_AUDIENCE;
  raw = raw.slice(0, MAX_AUDIENCE);

  // Registros relacionados, lidos em lote (todas as entidades para qualquer base).
  const ids = (k: string) => raw.map((r) => r[k]).filter(Boolean) as string[];
  const selfIds = ids("id");

  // Contatos (etapa 1) — as demais leituras dependem só da base e destes contatos.
  let contactIds: string[] = [];
  if (base === "leads") contactIds = ids("converted_contact_id");
  if (base === "deals") contactIds = ids("primary_contact_id");
  const none = Promise.resolve([] as R[]);
  const [contactRows, companyContactRows] = await Promise.all([
    fetchByIds(db, "contacts", SELECT.contacts, contactIds, workspaceId),
    base === "companies"
      ? fetchWhereIn(db, "contacts", SELECT.contacts, "company_id", selfIds, workspaceId)
      : none,
  ]);
  const contacts = new Map(contactRows.map((c) => [c.id as string, c]));
  const companyContacts =
    base === "companies"
      ? firstBy(
          companyContactRows,
          "company_id",
          (c) => pickWhatsAppNumber([c.whatsapp_e164, c.mobile_phone, c.phone]).status === "ok",
        )
      : new Map<string, R>();

  // Etapa 2, em paralelo: negócios, empresas e leads convertidos.
  const relatedContacts = [...contacts.values(), ...companyContacts.values()];
  const companyIds =
    base === "companies"
      ? []
      : [...ids("company_id"), ...relatedContacts.map((c) => c.company_id!)];
  const contactKeys =
    base === "contacts" ? selfIds : [...contacts.keys(), ...relatedContacts.map((c) => c.id!)];
  const [dealRows, contactDealRows, companyDealRows, companyRows, leadRows] = await Promise.all([
    base === "leads"
      ? fetchByIds(db, "deals", SELECT.deals, ids("converted_deal_id"), workspaceId)
      : none,
    base === "contacts"
      ? fetchWhereIn(db, "deals", SELECT.deals, "primary_contact_id", selfIds, workspaceId, true)
      : none,
    base === "companies"
      ? fetchWhereIn(db, "deals", SELECT.deals, "company_id", selfIds, workspaceId, true)
      : none,
    fetchByIds(db, "companies", SELECT.companies, companyIds, workspaceId),
    base === "leads"
      ? none
      : fetchWhereIn(db, "leads", SELECT.leads, "converted_contact_id", contactKeys, workspaceId),
  ]);
  const dealById = new Map(dealRows.map((d) => [d.id as string, d]));
  const dealsByContact =
    base === "contacts" ? firstBy(contactDealRows, "primary_contact_id") : new Map<string, R>();
  const dealsByCompany =
    base === "companies" ? firstBy(companyDealRows, "company_id") : new Map<string, R>();
  const companies = new Map(companyRows.map((c) => [c.id as string, c]));
  const leadsByContact =
    base === "leads" ? new Map<string, R>() : firstBy(leadRows, "converted_contact_id");

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
  const profileParts = await inPool(chunk(userIds), async (part) => {
    const { data, error } = await db.from("profiles").select("id, full_name").in("id", part);
    if (error) throw new Error(error.message);
    return (data ?? []) as R[];
  });
  for (const p of profileParts.flat()) if (p.full_name) people.set(p.id!, p.full_name);
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
    "lead.job_title": l?.job_title,
    "lead.cargo_resumido": l?.cargo_resumido,
    "lead.area_atuacao": l?.area_atuacao,
    "lead.nivel_hierarquico": l?.nivel_hierarquico,
    "lead.company_name": l?.company_name,
    "lead.source": l?.source,
    "lead.status": l?.status ? (LEAD_STATUS[l.status] ?? l.status) : null,
  });
  const companyValues = (c?: R) => ({
    "company.name": c?.name,
    "company.size_description": c?.size_description,
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
    "contact.cargo_resumido": c?.cargo_resumido,
    "contact.area_atuacao": c?.area_atuacao,
    "contact.nivel_hierarquico": c?.nivel_hierarquico,
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
        phone: r.whatsapp_e164 || r.mobile_phone || r.phone,
        phones: [r.whatsapp_e164, r.mobile_phone, r.phone],
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
        phone: r.whatsapp_e164 || r.mobile_phone || r.phone,
        phones: [r.whatsapp_e164, r.mobile_phone, r.phone],
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
        phone: contact?.whatsapp_e164 || contact?.mobile_phone || r.phone,
        phones: [contact?.whatsapp_e164, contact?.mobile_phone, contact?.phone, r.phone],
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
      phone: contact ? contact.whatsapp_e164 || contact.mobile_phone || contact.phone : null,
      phones: contact ? [contact.whatsapp_e164, contact.mobile_phone, contact.phone] : [],
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

/**
 * Lê todas as páginas (a API devolve no máximo 1.000 linhas por chamada), ordenando
 * por id para a paginação ser estável, até `cap` linhas.
 */
async function fetchAllPages(build: () => Db, cap: number): Promise<Db[]> {
  const out: Db[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build()
      .order("id", { ascending: true })
      .range(from, Math.min(from + 999, cap - 1));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Db[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Telefones que pediram para não receber mensagens (opt-out do SDR) no workspace. */
export async function loadOptedOutPhones(db: Db, workspaceId: string): Promise<Set<string>> {
  const rows = await fetchAllPages(
    () =>
      db
        .from("sdr_enrollments")
        .select("id, contact_phone")
        .eq("workspace_id", workspaceId)
        .not("opted_out_at", "is", null),
    10000,
  );
  return new Set((rows as R[]).map((r) => r.contact_phone).filter(Boolean) as string[]);
}

/** Envios de WhatsApp de campanhas do workspace desde `since` (mesmo canal), por telefone. */
export async function loadRecentWhatsAppSends(
  db: Db,
  workspaceId: string,
  since: string,
  excludeCampaignId?: string,
) {
  const { indexRecent, phoneRecentKey } = await import("@/lib/campaigns/recent-contact");
  const rows = await fetchAllPages(() => {
    let q = db
      .from("whatsapp_campaign_recipients")
      .select("id, phone, sent_at, campaign_id, whatsapp_campaigns(name)")
      .eq("workspace_id", workspaceId)
      .eq("status", "sent")
      .gte("sent_at", since);
    if (excludeCampaignId) q = q.neq("campaign_id", excludeCampaignId);
    return q;
  }, 20000);
  return indexRecent(
    rows.map((r) => ({
      key: phoneRecentKey(String(r.phone ?? "")),
      at: (r.sent_at as string | null) ?? null,
      campaignName: (r.whatsapp_campaigns?.name as string | undefined) ?? null,
    })),
  );
}
