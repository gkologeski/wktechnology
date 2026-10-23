import { readHrPrivate, protectHrPrivatePayload } from "@/lib/access-control/hr-private.server";
import { assertHrRecordAccess, assertHrCreate } from "@/lib/access-control/hr-records.server";
import { emailSchema } from "@/lib/email-schema";
// Server functions para o módulo TechPeople (Sprint 1 — HRIS core).
// Fornece list/get/upsert/archive de `people`, com projeção de campos
// sensíveis conforme as permissões efetivas e o vínculo com a pessoa.
import { createServerFn } from "@tanstack/react-start";
import { orSafeTerm } from "@/lib/postgrest-search";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAutoStart } from "@/lib/people/onboarding.functions";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

import { humanPhoneForRow, sourcePhone, workspacePhoneCountry } from "@/lib/phone/phone-boundary";
export const PEOPLE_EMPLOYMENT_TYPES = ["pj", "clt", "contractor", "intern", "other"] as const;
export const PEOPLE_STATUSES = [
  "active",
  "bench",
  "on_leave",
  "offboarding",
  "terminated",
] as const;

export type PeopleEmploymentType = (typeof PEOPLE_EMPLOYMENT_TYPES)[number];
export type PeopleStatus = (typeof PEOPLE_STATUSES)[number];

export const PEOPLE_STATUS_LABELS: Record<PeopleStatus, string> = {
  active: "Ativo",
  bench: "Bench",
  on_leave: "Afastado",
  offboarding: "Em desligamento",
  terminated: "Desligado",
};

export const PEOPLE_EMPLOYMENT_LABELS: Record<PeopleEmploymentType, string> = {
  pj: "PJ",
  clt: "CLT",
  contractor: "Terceiro",
  intern: "Estagiário",
  other: "Outro",
};

export type PersonDocMap = Record<string, string | number | boolean | null>;

export type PersonRow = {
  id: string;
  owner_id: string;
  profile_id: string | null;
  candidate_id: string | null;
  manager_id: string | null;
  full_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  employment_type: PeopleEmploymentType;
  status: PeopleStatus;
  role_title: string | null;
  seniority: string | null;
  location: string | null;
  timezone: string | null;
  hire_date: string | null;
  termination_date: string | null;
  legal_entity_name: string | null;
  cnpj: string | null;
  trade_name: string | null;
  simples_optante: boolean | null;
  cost_hour: number | null;
  monthly_cost: number | null;
  currency: string;
  personal_doc: PersonDocMap;
  tags: string[];
  notes: string | null;
  education: string | null;
  shirt_size: string | null;
  emergency_phone: string | null;
  emergency_relationship: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  assigned_to: string | null;
  bank: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  address: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  /** Preenchido no server quando o usuário pode ver dados sensíveis. */
  can_view_sensitive?: boolean;
  can_update_sensitive?: boolean;
};

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  full_name: z.string().min(2).max(160),
  preferred_name: z.string().max(80).nullable().optional(),
  email: emailSchema().nullable().optional().or(z.literal("")),
  phone: z.string().max(40).nullable().optional(),
  photo_url: z.string().url().nullable().optional().or(z.literal("")),
  employment_type: z.enum(PEOPLE_EMPLOYMENT_TYPES).default("pj"),
  status: z.enum(PEOPLE_STATUSES).default("active"),
  role_title: z.string().max(120).nullable().optional(),
  seniority: z.string().max(60).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  hire_date: z.string().nullable().optional(),
  termination_date: z.string().nullable().optional(),
  legal_entity_name: z.string().max(200).nullable().optional(),
  cnpj: z.string().max(20).nullable().optional(),
  trade_name: z.string().max(200).nullable().optional(),
  simples_optante: z.boolean().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  profile_id: z.string().uuid().nullable().optional(),
  candidate_id: z.string().uuid().nullable().optional(),
  cost_hour: z.number().nonnegative().nullable().optional(),
  monthly_cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("BRL"),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  notes: z.string().max(4000).nullable().optional(),
  education: z.string().max(120).nullable().optional(),
  shirt_size: z.string().max(120).nullable().optional(),
  emergency_phone: z.string().max(40).nullable().optional(),
  emergency_relationship: z.string().max(120).nullable().optional(),
  marital_status: z.string().max(60).nullable().optional(),
  spouse_name: z.string().max(160).nullable().optional(),
  bank: z.string().max(160).nullable().optional(),
  bank_agency: z.string().max(40).nullable().optional(),
  bank_account: z.string().max(60).nullable().optional(),
  pix_key: z.string().max(160).nullable().optional(),
  address: z.string().max(400).nullable().optional(),
});

function normalize(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

/**
 * Lista pessoas visíveis ao usuário. RLS aplica o filtro:
 * chave efetiva de leitura e vínculo próprio/equipe/workspace.
 */
export const listPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.enum(PEOPLE_STATUSES).nullable().optional(),
        include_archived: z.boolean().default(false),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("people")
      .select(
        // Campos sensíveis omitidos aqui — carregados no getPerson quando permitido.
        "id, owner_id, profile_id, candidate_id, manager_id, full_name, preferred_name, email, phone, photo_url, employment_type, status, role_title, seniority, location, timezone, hire_date, termination_date, legal_entity_name, cnpj, trade_name, simples_optante, currency, tags, education, shirt_size, emergency_phone, emergency_relationship, marital_status, spouse_name, assigned_to, archived, created_at, updated_at",
      )
      .order("full_name", { ascending: true })
      .limit(500);
    if (!data.include_archived) q = q.eq("archived", false);
    if (data.status) q = q.eq("status", data.status);
    if (data.search && data.search.trim().length >= 2) {
      const s = orSafeTerm(data.search);
      q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,role_title.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // userId used to allow future extensions (e.g., "my team only" flag).
    void userId;
    return (rows ?? []) as unknown as PersonRow[];
  });

/**
 * Retorna a ficha de uma pessoa. Campos sensíveis só são preenchidos
 * quando a permissão independente de dados privados permite a leitura.
 */
export const getPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Base fields — RLS já valida o acesso à linha.
    const { data: base, error } = await supabase
      .from("people")
      .select(
        "id, owner_id, profile_id, candidate_id, manager_id, full_name, preferred_name, email, phone, photo_url, employment_type, status, role_title, seniority, location, timezone, hire_date, termination_date, legal_entity_name, cnpj, trade_name, simples_optante, currency, tags, notes, education, shirt_size, emergency_phone, emergency_relationship, marital_status, spouse_name, assigned_to, archived, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!base) throw new Error("Pessoa não encontrada");

    const privateRow = (await readHrPrivate(supabase, "people_sensitive", [data.id])).get(data.id);
    const canViewSensitive = privateRow?.can_view === true;
    const sensitive = {
      cost_hour: null,
      monthly_cost: null,
      personal_doc: {},
      bank: null,
      bank_agency: null,
      bank_account: null,
      pix_key: null,
      address: null,
      ...(privateRow?.fields ?? {}),
    };

    let manager_name: string | null = null;
    const managerId = (base as { manager_id: string | null }).manager_id;
    if (managerId) {
      const { data: mgr } = await supabase
        .from("people")
        .select("full_name")
        .eq("id", managerId)
        .maybeSingle();
      manager_name = (mgr as { full_name: string | null } | null)?.full_name ?? null;
    }

    return {
      ...(base as Omit<
        PersonRow,
        | "cost_hour"
        | "monthly_cost"
        | "personal_doc"
        | "bank"
        | "bank_agency"
        | "bank_account"
        | "pix_key"
        | "address"
      >),
      ...sensitive,
      can_view_sensitive: canViewSensitive,
      can_update_sensitive: privateRow?.can_update === true,
      manager_name,
    } as PersonRow & { manager_name: string | null };
  });

/**
 * Cria ou atualiza uma pessoa com ação e escopo validados no servidor e na RLS.
 */
export const upsertPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    if (data.id) await assertHrRecordAccess(supabase, "people", "update", data.id);
    else await assertHrCreate(supabase, userId, "techpeople.people");
    const phoneCountry = await workspacePhoneCountry(supabase, workspaceId);
    const personPhone = await humanPhoneForRow(
      supabase,
      { table: "people", id: data.id, column: "phone" },
      normalize(data.phone ?? null),
      { field: "Telefone", country: phoneCountry },
    );
    const personEmergencyPhone = await humanPhoneForRow(
      supabase,
      { table: "people", id: data.id, column: "emergency_phone" },
      normalize(data.emergency_phone ?? null),
      { field: "Telefone de recado", country: phoneCountry },
    );
    const payload: Record<string, unknown> = {
      full_name: data.full_name,
      preferred_name: normalize(data.preferred_name ?? null),
      email: normalize(data.email ?? null),
      phone: personPhone,
      photo_url: normalize(data.photo_url ?? null),
      employment_type: data.employment_type,
      status: data.status,
      role_title: normalize(data.role_title ?? null),
      seniority: normalize(data.seniority ?? null),
      location: normalize(data.location ?? null),
      timezone: normalize(data.timezone ?? null),
      hire_date: data.hire_date || null,
      termination_date: data.termination_date || null,
      legal_entity_name: normalize(data.legal_entity_name ?? null),
      cnpj: normalize(data.cnpj ?? null),
      trade_name: normalize(data.trade_name ?? null),
      simples_optante: data.simples_optante ?? null,
      manager_id: data.manager_id ?? null,
      profile_id: data.profile_id ?? null,
      candidate_id: data.candidate_id ?? null,

      currency: data.currency,
      tags: data.tags,
      notes: normalize(data.notes ?? null),
      education: normalize(data.education ?? null),
      shirt_size: normalize(data.shirt_size ?? null),
      emergency_phone: personEmergencyPhone,
      emergency_relationship: normalize(data.emergency_relationship ?? null),
      marital_status: normalize(data.marital_status ?? null),
      spouse_name: normalize(data.spouse_name ?? null),
    };

    const privateColumns = [
      "cost_hour",
      "monthly_cost",
      "bank",
      "bank_agency",
      "bank_account",
      "pix_key",
      "address",
    ];
    for (const key of privateColumns) {
      const value = data[key as keyof typeof data];
      if (value !== undefined) payload[key] = typeof value === "string" ? normalize(value) : value;
    }
    await protectHrPrivatePayload(
      supabase,
      "people_sensitive",
      data.id,
      null,
      payload,
      privateColumns,
    );

    if (data.id) {
      // Detecta transição de status para `offboarding` para disparar automação.
      const { data: prev } = await supabase
        .from("people")
        .select("status")
        .eq("id", data.id)
        .maybeSingle();
      const prevStatus = (prev as { status: PeopleStatus | null } | null)?.status ?? null;
      const { data: saved, error } = await supabase
        .from("people")
        .update(payload as never)
        .eq("workspace_id", workspaceId)
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!saved) throw new Error("Pessoa indisponível ou sem permissão para editar.");
      if (data.status === "offboarding" && prevStatus !== "offboarding") {
        // Idempotente: só cria plano se ainda não existir offboarding.
        await runAutoStart(supabase as never, {
          userId,
          personId: data.id,
          kind: "offboarding",
        }).catch(() => undefined);
      }
      return { id: data.id };
    }

    // workspace_id é a fonte de verdade do isolamento; owner_id segue espelhado (legado).
    const insertPayload = {
      ...payload,
      workspace_id: workspaceId,
      owner_id: workspaceId,
      assigned_to: userId,
      created_by: userId,
    };
    const { data: row, error } = await supabase
      .from("people")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = (row as { id: string }).id;
    if (data.status === "offboarding") {
      await runAutoStart(supabase as never, {
        userId,
        personId: newId,
        kind: "offboarding",
      }).catch(() => undefined);
    }
    return { id: newId };
  });

export const archivePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHrRecordAccess(supabase, "people", "update", data.id);
    const { data: saved, error } = await supabase
      .from("people")
      .update({ archived: data.archived } as never)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!saved) throw new Error("Pessoa indisponível ou sem permissão para arquivar.");
    return { ok: true };
  });

/**
 * Promove um candidato aprovado para uma pessoa (Sprint 1).
 * Cria a `person` vinculada ao `candidate_id` (unique por workspace).
 * Idempotente: se já existe pessoa para o candidato, retorna o id existente.
 */
export const promoteCandidateToPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        employment_type: z.enum(PEOPLE_EMPLOYMENT_TYPES).default("pj"),
        role_title: z.string().max(120).nullable().optional(),
        hire_date: z.string().nullable().optional(),
        manager_id: z.string().uuid().nullable().optional(),
        cost_hour: z.number().nonnegative().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const workspaceId = await assertHrCreate(supabase, userId, "techpeople.people");
    await assertHrRecordAccess(supabase, "candidates", "view", data.candidate_id);
    // Se já foi promovido, devolve o mesmo id.
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("candidate_id", data.candidate_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (existing) return { id: (existing as { id: string }).id, existed: true };

    const { data: cand, error: candErr } = await supabase
      .from("ats_candidates")
      .select("owner_id, full_name, email, phone, location, photo_url, current_position")
      .eq("id", data.candidate_id)
      .maybeSingle();
    if (candErr) throw new Error(candErr.message);
    if (!cand) throw new Error("Candidato não encontrado");

    const c = cand as {
      owner_id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      location: string | null;
      photo_url: string | null;
      current_position: string | null;
    };

    const insertPayload = {
      owner_id: workspaceId,
      workspace_id: workspaceId,
      assigned_to: userId,
      candidate_id: data.candidate_id,
      full_name: c.full_name,
      email: c.email,
      phone: sourcePhone(c.phone),
      location: c.location,
      photo_url: c.photo_url,
      role_title: data.role_title ?? c.current_position ?? null,
      employment_type: data.employment_type,
      status: "active" as PeopleStatus,
      hire_date: data.hire_date || new Date().toISOString().slice(0, 10),
      manager_id: data.manager_id ?? null,
      ...(data.cost_hour !== undefined ? { cost_hour: data.cost_hour } : {}),
      created_by: userId,
    };

    const { data: row, error } = await supabase
      .from("people")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = (row as { id: string }).id;
    // Sprint 7 — Automação: dispara plano de onboarding padrão (idempotente).
    await runAutoStart(supabase as never, {
      userId,
      personId: newId,
      kind: "onboarding",
    }).catch(() => undefined);
    return { id: newId, existed: false };
  });
