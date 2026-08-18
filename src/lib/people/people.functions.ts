// Server functions para o módulo TechPeople (Sprint 1 — HRIS core).
// Fornece list/get/upsert/archive de `people`, com projeção de campos
// sensíveis conforme o papel do usuário (admin, gestor, própria pessoa).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAutoStart } from "@/lib/people/onboarding.functions";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";


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
};


const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  full_name: z.string().min(2).max(160),
  preferred_name: z.string().max(80).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
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
  shirt_size: z.string().max(20).nullable().optional(),
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
 * admin vê tudo, gestor vê o próprio time, pessoa vê o próprio registro.
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
      const s = data.search.trim();
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
 * quando o chamador é admin do workspace (verificado via can_view_person_sensitive).
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

    // Verifica se o chamador pode ver campos sensíveis.
    const { data: canSens } = await supabase.rpc("can_view_person_sensitive", {
      _person_id: data.id,
    });
    const canViewSensitive = canSens === true;

    let sensitive: {
      cost_hour: number | null;
      monthly_cost: number | null;
      personal_doc: PersonDocMap;
      bank: string | null;
      bank_agency: string | null;
      bank_account: string | null;
      pix_key: string | null;
      address: string | null;
    } = {
      cost_hour: null,
      monthly_cost: null,
      personal_doc: {},
      bank: null,
      bank_agency: null,
      bank_account: null,
      pix_key: null,
      address: null,
    };

    if (canViewSensitive) {
      const { data: sensRow, error: sensErr } = await supabase
        .from("people")
        .select("cost_hour, monthly_cost, personal_doc, bank, bank_agency, bank_account, pix_key, address")
        .eq("id", data.id)
        .maybeSingle();
      if (sensErr) throw new Error(sensErr.message);
      if (sensRow) {
        const r = sensRow as Record<string, unknown>;
        sensitive = {
          cost_hour: (r.cost_hour as number | null) ?? null,
          monthly_cost: (r.monthly_cost as number | null) ?? null,
          personal_doc: ((r.personal_doc as PersonDocMap | null) ?? {}) as PersonDocMap,
          bank: (r.bank as string | null) ?? null,
          bank_agency: (r.bank_agency as string | null) ?? null,
          bank_account: (r.bank_account as string | null) ?? null,
          pix_key: (r.pix_key as string | null) ?? null,
          address: (r.address as string | null) ?? null,
        };
      }
    }

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
      ...(base as Omit<PersonRow, "cost_hour" | "monthly_cost" | "personal_doc" | "bank" | "bank_agency" | "bank_account" | "pix_key" | "address">),
      ...sensitive,
      can_view_sensitive: canViewSensitive,
      manager_name,
    } as PersonRow & { manager_name: string | null };
  });


/**
 * Cria ou atualiza uma pessoa. Apenas admin do workspace tem write (RLS).
 */
export const upsertPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceIdForCheck = await getActiveWorkspaceId(supabase, userId);
    await assertAnyPermission(supabase, userId, workspaceIdForCheck, [
      data.id ? "techpeople.people.update.own" : "techpeople.people.create.own",
      "techpeople.people.update.workspace",
    ]);


    // owner_id vem do workspace ativo do usuário (via profiles.active_workspace_id).
    let ownerId: string | null = null;
    if (!data.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", userId)
        .maybeSingle();
      ownerId = (prof as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
      if (!ownerId) throw new Error("Workspace ativo não encontrado");
    }

    const payload: Record<string, unknown> = {
      full_name: data.full_name,
      preferred_name: normalize(data.preferred_name ?? null),
      email: normalize(data.email ?? null),
      phone: normalize(data.phone ?? null),
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
      cost_hour: data.cost_hour ?? null,
      monthly_cost: data.monthly_cost ?? null,
      currency: data.currency,
      tags: data.tags,
      notes: normalize(data.notes ?? null),
      education: normalize(data.education ?? null),
      shirt_size: normalize(data.shirt_size ?? null),
      emergency_phone: normalize(data.emergency_phone ?? null),
      emergency_relationship: normalize(data.emergency_relationship ?? null),
      marital_status: normalize(data.marital_status ?? null),
      spouse_name: normalize(data.spouse_name ?? null),
      bank: normalize(data.bank ?? null),
      bank_agency: normalize(data.bank_agency ?? null),
      bank_account: normalize(data.bank_account ?? null),
      pix_key: normalize(data.pix_key ?? null),
      address: normalize(data.address ?? null),
    };


    if (data.id) {
      // Detecta transição de status para `offboarding` para disparar automação.
      const { data: prev } = await supabase
        .from("people")
        .select("status")
        .eq("id", data.id)
        .maybeSingle();
      const prevStatus = (prev as { status: PeopleStatus | null } | null)?.status ?? null;
      const { error } = await supabase
        .from("people")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
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
      workspace_id: ownerId,
      owner_id: ownerId,
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
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceIdForCheck = await getActiveWorkspaceId(supabase, userId);
    await assertAnyPermission(supabase, userId, workspaceIdForCheck, [
      "techpeople.people.update.workspace",
      "techpeople.people.delete.workspace",
    ]);
    const { error } = await context.supabase
      .from("people")
      .update({ archived: data.archived } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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

    // Se já foi promovido, devolve o mesmo id.
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("candidate_id", data.candidate_id)
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
      owner_id: c.owner_id,
      candidate_id: data.candidate_id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      location: c.location,
      photo_url: c.photo_url,
      role_title: data.role_title ?? c.current_position ?? null,
      employment_type: data.employment_type,
      status: "active" as PeopleStatus,
      hire_date: data.hire_date || new Date().toISOString().slice(0, 10),
      manager_id: data.manager_id ?? null,
      cost_hour: data.cost_hour ?? null,
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

