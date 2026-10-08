// Perfis de vaga do negócio — regras de servidor. Usa o cliente do usuário (RLS)
// para dados de negócio; o admin só entra em storage privado, link público
// (após validar token) e avisos internos.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { assertPermission, hasPermission } from "@/lib/access-control/enforce.server";
import { sniff, sha256 } from "@/lib/import/document-source";
import {
  CommercialDataZ,
  MANUAL_TRANSITIONS,
  ProfileDataZ,
  ProfileHeaderZ,
  approvalMissing,
  diffProfiles,
  parseData,
  sanitizeAllowedFields,
  snapshotOf,
  toAtsJob,
  toTemplatePayload,
  type ProfileLike,
  type ProfileStatus,
} from "./schema";
import {
  computeEligibility,
  divergenceFrom,
  suggestionFromLine,
  type PrefillLine,
} from "./eligibility";

type Sb = SupabaseClient<Database>;
export type Ctx = { supabase: Sb; userId: string; workspaceId: string };

export const PERM = {
  view: "techsales.role_profiles.view.workspace",
  create: "techsales.role_profiles.create.workspace",
  update: "techsales.role_profiles.update.workspace",
  commercial: "techsales.role_profiles_commercial.view.workspace",
  approve: "techsales.role_profiles.approve.workspace",
  early: "techsales.role_profiles_early.approve.workspace",
  forward: "techsales.role_profiles.manage.workspace",
  share: "techsales.role_profiles_share.manage.workspace",
} as const;
export type PermFlags = Record<keyof typeof PERM, boolean>;

export const BUCKET = "role-profile-files";
const PROFILE_COLS =
  "id, workspace_id, deal_id, company_id, contact_id, title, quantity, modality, priority, seniority, status, data, revision, approved_version_id, last_version, ats_job_id, ats_synced_version, assigned_to, created_by, created_at, updated_at";

export async function permFlags(ctx: Ctx): Promise<PermFlags> {
  const entries = await Promise.all(
    (Object.keys(PERM) as (keyof typeof PERM)[]).map(
      async (k) =>
        [k, await hasPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM[k])] as const,
    ),
  );
  return Object.fromEntries(entries) as PermFlags;
}

function friendly(e: { message?: string } | null | undefined): Error {
  const m = e?.message ?? "Erro inesperado";
  if (m.includes("STALE_REVISION"))
    return new Error(
      "Outra pessoa alterou este perfil. Recarregue para ver a versão mais recente.",
    );
  if (m.includes("PERMISSION_DENIED")) return new Error("Você não tem permissão para esta ação.");
  if (m.includes("EARLY_REQUIRED"))
    return new Error(
      "O negócio ainda não foi ganho. Encaminhar exige autorização comercial antecipada com motivo.",
    );
  return new Error(m);
}

async function loadDeal(ctx: Ctx, dealId: string) {
  const { data, error } = await ctx.supabase
    .from("deals")
    .select("id, name, company_id, primary_contact_id, workspace_id, stage, stage_id, assigned_to")
    .eq("id", dealId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!data) throw new Error("Negócio não encontrado ou sem acesso.");
  return data;
}

export async function loadProfile(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase
    .from("deal_role_profiles")
    .select(PROFILE_COLS)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!data) throw new Error("Perfil não encontrado ou sem acesso.");
  return data;
}
type ProfileRow = Awaited<ReturnType<typeof loadProfile>>;

export function rowToLike(
  r: Pick<
    ProfileRow,
    "title" | "quantity" | "modality" | "priority" | "seniority" | "contact_id" | "data"
  >,
): ProfileLike {
  return {
    title: r.title,
    quantity: r.quantity,
    modality: r.modality as ProfileLike["modality"],
    priority: r.priority as ProfileLike["priority"],
    seniority: (r.seniority as ProfileLike["seniority"]) ?? null,
    contact_id: r.contact_id,
    data: parseData(r.data),
  };
}

/** Itens de linha do negócio com catálogo, preset e cargo (IDs reais). */
export async function loadDealLines(ctx: Ctx, dealId: string): Promise<PrefillLine[]> {
  const { data, error } = await ctx.supabase
    .from("deal_line_items")
    .select(
      "id, name, quantity, seniority, service_catalog_id, contracting_preset_id, job_profile_id, service_catalog:service_catalog_id(name), preset:contracting_preset_id(name, seniority, job_profile_id), job_profile:job_profile_id(name, seniority)",
    )
    .eq("deal_id", dealId)
    .eq("workspace_id", ctx.workspaceId)
    .order("position", { ascending: true });
  if (error) throw friendly(error);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    name: string | null;
    quantity: number | null;
    seniority: string | null;
    service_catalog_id: string | null;
    contracting_preset_id: string | null;
    job_profile_id: string | null;
    service_catalog: { name: string } | null;
    preset: { name: string; seniority: string | null; job_profile_id: string | null } | null;
    job_profile: { name: string; seniority: string | null } | null;
  }>;
  // Cargo herdado do preset quando o item não tem cargo próprio.
  const missingJp = [
    ...new Set(
      rows
        .filter((r) => !r.job_profile_id && r.preset?.job_profile_id)
        .map((r) => r.preset!.job_profile_id!),
    ),
  ];
  const { data: jps } = missingJp.length
    ? await ctx.supabase
        .from("job_profiles")
        .select("id, name, seniority")
        .in("id", missingJp)
        .eq("workspace_id", ctx.workspaceId)
    : { data: [] as { id: string; name: string; seniority: string | null }[] };
  const jpMap = new Map((jps ?? []).map((j) => [j.id, j]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    seniority: r.seniority,
    service_catalog_id: r.service_catalog_id,
    catalogName: r.service_catalog?.name ?? null,
    contracting_preset_id: r.contracting_preset_id,
    job_profile_id: r.job_profile_id,
    preset: r.preset,
    jobProfile:
      r.job_profile ??
      (r.preset?.job_profile_id ? (jpMap.get(r.preset.job_profile_id) ?? null) : null),
  }));
}

/** Elegível só com serviço de catálogo cujo nome contém Hunting ou Outsourcing. */
export async function dealEligibility(ctx: Ctx, dealId: string) {
  return computeEligibility(await loadDealLines(ctx, dealId));
}

async function notifyAssignee(
  ctx: Ctx,
  p: { id: string; deal_id: string; assigned_to: string | null; title: string },
  title: string,
  body: string,
) {
  const target = p.assigned_to;
  if (!target || target === ctx.userId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      owner_id: target,
      user_id: target,
      workspace_id: ctx.workspaceId,
      type: "role_profile",
      title,
      body,
      link: `/deals/${p.deal_id}?profile=${p.id}`,
      entity: "deal",
      entity_id: p.deal_id,
      dedupe_key: `role_profile:${p.id}:${title}:${Date.now()}`,
    } as never);
  } catch {
    /* aviso é best-effort */
  }
}

async function logEvent(
  ctx: Ctx,
  profileId: string,
  kind: string,
  extra: Partial<{
    from_status: string;
    to_status: string;
    version: number;
    reason: string;
    details: Json;
  }> = {},
) {
  await ctx.supabase.from("deal_role_profile_events").insert({
    profile_id: profileId,
    workspace_id: ctx.workspaceId,
    kind,
    actor_id: ctx.userId,
    actor_kind: "user",
    ...extra,
  });
}

// ---------------------------------------------------------------------------

export async function listForDeal(ctx: Ctx, dealId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  const deal = await loadDeal(ctx, dealId);
  const [{ data: rows, error }, lines, perms, { data: templates }] = await Promise.all([
    ctx.supabase
      .from("deal_role_profiles")
      .select(
        "id, title, quantity, modality, priority, seniority, status, revision, last_version, ats_job_id, ats_synced_version, assigned_to, updated_at, data, contact_id, source_line_item_id, job_profile_id, contracting_preset_id",
      )
      .eq("deal_id", dealId)
      .eq("workspace_id", ctx.workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    loadDealLines(ctx, dealId),
    permFlags(ctx),
    ctx.supabase
      .from("deal_role_profile_templates")
      .select("id, name, modality, seniority")
      .eq("workspace_id", ctx.workspaceId)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (error) throw friendly(error);
  const eligibility = computeEligibility(lines);
  const suggestionsAll = lines
    .map(suggestionFromLine)
    .filter((x): x is NonNullable<typeof x> => !!x);
  const byLine = new Map(suggestionsAll.map((x) => [x.lineItemId, x]));
  const linked = new Set((rows ?? []).map((r) => r.source_line_item_id).filter(Boolean));
  const assignees = [
    ...new Set((rows ?? []).map((r) => r.assigned_to).filter(Boolean)),
  ] as string[];
  const { data: people } = assignees.length
    ? await ctx.supabase.from("profiles").select("id, full_name").in("id", assignees)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const profiles = (rows ?? []).map((r) => {
    const like = rowToLike(r);
    return {
      id: r.id,
      title: r.title,
      quantity: r.quantity,
      modality: r.modality,
      priority: r.priority,
      seniority: r.seniority,
      status: r.status,
      revision: r.revision,
      lastVersion: r.last_version,
      atsJobId: r.ats_job_id,
      atsSyncedVersion: r.ats_synced_version,
      atsOutdated: !!r.ats_job_id && r.ats_synced_version !== r.last_version,
      assignedTo: r.assigned_to,
      assignedName: r.assigned_to ? (names.get(r.assigned_to) ?? null) : null,
      updatedAt: r.updated_at,
      missing: approvalMissing(like),
      workMode: like.data.conditions.work_mode ?? null,
      sourceLineItemId: r.source_line_item_id,
      jobProfileId: r.job_profile_id,
      presetId: r.contracting_preset_id,
      contactId: r.contact_id,
      data: like.data,
      divergence:
        r.source_line_item_id && byLine.get(r.source_line_item_id)
          ? divergenceFrom(r, byLine.get(r.source_line_item_id)!)
          : [],
      sourceMissing: !!r.source_line_item_id && !byLine.has(r.source_line_item_id),
    };
  });
  return {
    deal: {
      id: deal.id,
      name: deal.name,
      companyId: deal.company_id,
      won: deal.stage === "won" || /won/i.test(deal.stage_id ?? ""),
    },
    eligibility,
    perms,
    profiles,
    suggestions: suggestionsAll.filter((x) => !linked.has(x.lineItemId)),
    totals: { profiles: profiles.length, positions: profiles.reduce((a, p) => a + p.quantity, 0) },
    templates: templates ?? [],
  };
}

export async function getDetail(ctx: Ctx, id: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  const p = await loadProfile(ctx, id);
  const perms = await permFlags(ctx);
  const [versions, events, attachments, links, proposals, handoff, commercial] = await Promise.all([
    ctx.supabase
      .from("deal_role_profile_versions")
      .select("id, version, snapshot, approved_by, approved_at")
      .eq("profile_id", id)
      .order("version", { ascending: false }),
    ctx.supabase
      .from("deal_role_profile_events")
      .select(
        "id, kind, from_status, to_status, version, reason, details, actor_id, actor_kind, created_at",
      )
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    ctx.supabase
      .from("deal_role_profile_attachments")
      .select("id, filename, mime, size_bytes, uploaded_by_kind, created_at")
      .eq("profile_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    perms.share
      ? ctx.supabase
          .from("deal_role_profile_share_links")
          .select(
            "id, allowed_fields, expires_at, revoked_at, read_count, max_reads, write_count, max_writes, last_access_at, created_at",
          )
          .eq("profile_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    ctx.supabase
      .from("deal_role_profile_client_proposals")
      .select("id, payload, status, base_revision, confirmed, created_at, reviewed_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("deal_role_profile_handoffs")
      .select(
        "ats_job_id, early, early_reason, authorized_by, created_at, last_synced_version, last_synced_at",
      )
      .eq("profile_id", id)
      .maybeSingle(),
    perms.commercial
      ? ctx.supabase
          .from("deal_role_profile_commercial")
          .select("data, updated_at")
          .eq("profile_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const actorIds = [
    ...new Set(
      [
        ...(events.data ?? []).map((e) => e.actor_id),
        ...(versions.data ?? []).map((v) => v.approved_by),
      ].filter(Boolean),
    ),
  ] as string[];
  const { data: people } = actorIds.length
    ? await ctx.supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const like = rowToLike(p);
  const approved =
    (versions.data ?? []).find((v) => v.id === p.approved_version_id) ?? (versions.data ?? [])[0];
  const pending = (versions.data ?? [])[0];
  const snap = pending ? (pending.snapshot as unknown as ProfileLike) : null;
  const diff = snap ? diffProfiles({ ...snap, data: parseData(snap.data) }, like) : [];
  return {
    profile: { ...p, data: like.data },
    commercial: commercial.data
      ? (CommercialDataZ.safeParse(commercial.data.data).data ?? null)
      : null,
    perms,
    missing: approvalMissing(like),
    versions: versions.data ?? [],
    approvedVersion: approved?.version ?? null,
    diffSinceLastVersion: diff,
    events: events.data ?? [],
    people: Object.fromEntries((people ?? []).map((x) => [x.id, x.full_name])),
    attachments: attachments.data ?? [],
    links: links.data ?? [],
    proposals: proposals.data ?? [],
    handoff: handoff.data ?? null,
  };
}

export async function createProfile(
  ctx: Ctx,
  input: {
    dealId: string;
    header: unknown;
    data?: unknown;
    templateId?: string;
    duplicateOf?: string;
    importId?: string;
    links?: { sourceLineItemId?: string; jobProfileId?: string; presetId?: string };
  },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.create);
  const links = await validateLinks(ctx, input.dealId, input.links);
  const deal = await loadDeal(ctx, input.dealId);
  const elig = await dealEligibility(ctx, input.dealId);
  if (!elig.eligible)
    throw new Error(
      "Associe um serviço de Outsourcing ou Hunting ao negócio (itens de linha) antes de criar perfis.",
    );
  let header = ProfileHeaderZ.parse(input.header);
  let data = ProfileDataZ.parse(input.data ?? {});
  if (input.templateId) {
    const { data: t } = await ctx.supabase
      .from("deal_role_profile_templates")
      .select("payload")
      .eq("id", input.templateId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!t) throw new Error("Modelo não encontrado.");
    const payload = t.payload as unknown as { header: unknown; data: unknown };
    header = ProfileHeaderZ.parse({
      ...(payload.header as object),
      contact_id: header.contact_id ?? null,
      assigned_to: header.assigned_to ?? null,
    });
    data = ProfileDataZ.parse(payload.data);
  }
  if (input.duplicateOf) {
    const src = await loadProfile(ctx, input.duplicateOf);
    const t = toTemplatePayload(rowToLike(src));
    header = ProfileHeaderZ.parse({
      ...t.header,
      title: `${t.header.title} (cópia)`,
      contact_id: src.contact_id,
    });
    data = t.data;
  }
  // Contato só se pertencer ao mesmo workspace/empresa do negócio (sem duplicar contatos).
  let contactId = header.contact_id ?? deal.primary_contact_id ?? null;
  if (contactId) {
    const { data: c } = await ctx.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!c) contactId = null;
  }
  const { data: row, error } = await ctx.supabase
    .from("deal_role_profiles")
    .insert({
      workspace_id: ctx.workspaceId,
      deal_id: deal.id,
      company_id: deal.company_id,
      contact_id: contactId,
      title: header.title,
      quantity: header.quantity,
      modality: header.modality,
      priority: header.priority,
      seniority: header.seniority ?? null,
      assigned_to: header.assigned_to ?? deal.assigned_to ?? ctx.userId,
      data: data as unknown as Json,
      created_by: ctx.userId,
      source_line_item_id: links.sourceLineItemId,
      job_profile_id: links.jobProfileId,
      contracting_preset_id: links.presetId,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && links.sourceLineItemId) {
    // Já existe perfil para este item de linha: idempotente, não duplica.
    const { data: ex } = await ctx.supabase
      .from("deal_role_profiles")
      .select("id")
      .eq("deal_id", deal.id)
      .eq("source_line_item_id", links.sourceLineItemId)
      .is("archived_at", null)
      .maybeSingle();
    if (ex) return { id: ex.id, already: true };
  }
  if (error) throw friendly(error);
  await logEvent(
    ctx,
    row.id,
    input.duplicateOf
      ? "duplicated"
      : input.templateId
        ? "from_template"
        : input.importId
          ? "imported"
          : "created",
    {
      to_status: "draft",
      details: {
        duplicate_of: input.duplicateOf ?? null,
        template_id: input.templateId ?? null,
        import_id: input.importId ?? null,
      } as Json,
    },
  );
  if (input.importId) {
    await ctx.supabase
      .from("deal_role_profile_imports")
      .update({ status: "confirmed", profile_id: row.id, updated_at: new Date().toISOString() })
      .eq("id", input.importId)
      .eq("created_by", ctx.userId);
  }
  return { id: row.id };
}

async function validateLinks(
  ctx: Ctx,
  dealId: string,
  links: { sourceLineItemId?: string; jobProfileId?: string; presetId?: string } | undefined,
) {
  const out: {
    sourceLineItemId: string | null;
    jobProfileId: string | null;
    presetId: string | null;
  } = { sourceLineItemId: null, jobProfileId: null, presetId: null };
  if (!links) return out;
  if (links.sourceLineItemId) {
    const { data } = await ctx.supabase
      .from("deal_line_items")
      .select("id")
      .eq("id", links.sourceLineItemId)
      .eq("deal_id", dealId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!data) throw new Error("Item de linha não pertence a este negócio.");
    out.sourceLineItemId = data.id;
  }
  if (links.jobProfileId) {
    const { data } = await ctx.supabase
      .from("job_profiles")
      .select("id")
      .eq("id", links.jobProfileId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!data) throw new Error("Cargo não encontrado neste workspace.");
    out.jobProfileId = data.id;
  }
  if (links.presetId) {
    const { data } = await ctx.supabase
      .from("contracting_presets")
      .select("id")
      .eq("id", links.presetId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!data) throw new Error("Preset não encontrado neste workspace.");
    out.presetId = data.id;
  }
  return out;
}

/** Atualiza só o vínculo de título (cargo/preset) de um perfil existente. */
export async function setProfileTitleLink(
  ctx: Ctx,
  profileId: string,
  links: { jobProfileId?: string | null; presetId?: string | null },
) {
  const p = await loadProfile(ctx, profileId);
  const v = await validateLinks(ctx, p.deal_id, {
    jobProfileId: links.jobProfileId ?? undefined,
    presetId: links.presetId ?? undefined,
  });
  return v;
}

export async function saveProfile(
  ctx: Ctx,
  input: {
    id: string;
    expectedRevision: number;
    header: unknown;
    data: unknown;
    commercial?: unknown;
    links?: { jobProfileId?: string | null; presetId?: string | null };
  },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const cur = await loadProfile(ctx, input.id);
  if (input.commercial !== undefined)
    throw new Error("Dados comerciais internos não são mais editados no perfil de vaga.");
  const titleLinks = input.links ? await setProfileTitleLink(ctx, cur.id, input.links) : null;
  const header = ProfileHeaderZ.parse(input.header);
  const data = ProfileDataZ.parse(input.data);
  if (cur.revision !== input.expectedRevision)
    throw new Error("Outra pessoa alterou este perfil. Recarregue para ver a versão mais recente.");
  const before = rowToLike(cur);
  const after: ProfileLike = { ...header, data };
  const changes = diffProfiles(before, after);
  const wasApproved = cur.status === "approved" || cur.status === "forwarded";
  const nextStatus: ProfileStatus =
    wasApproved && changes.length ? "in_validation" : (cur.status as ProfileStatus);
  const { data: upd, error } = await ctx.supabase
    .from("deal_role_profiles")
    .update({
      title: header.title,
      quantity: header.quantity,
      modality: header.modality,
      priority: header.priority,
      seniority: header.seniority ?? null,
      assigned_to: header.assigned_to ?? cur.assigned_to,
      data: data as unknown as Json,
      status: nextStatus,
      revision: cur.revision + 1,
      ...(titleLinks
        ? { job_profile_id: titleLinks.jobProfileId, contracting_preset_id: titleLinks.presetId }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cur.id)
    .eq("revision", input.expectedRevision)
    .select("revision")
    .maybeSingle();
  if (error) throw friendly(error);
  if (!upd)
    throw new Error("Outra pessoa alterou este perfil. Recarregue para ver a versão mais recente.");

  if (changes.length) {
    await logEvent(ctx, cur.id, wasApproved ? "edited_after_approval" : "edited", {
      from_status: cur.status,
      to_status: nextStatus,
      details: {
        changes: changes.map((c) => ({ label: c.label, important: c.important })),
      } as Json,
    });
    if (wasApproved)
      await notifyAssignee(
        ctx,
        cur,
        "Perfil de vaga alterado após aprovação",
        `${cur.title}: ${changes.map((c) => c.label).join(", ")}. Requer nova aprovação.`,
      );
  }
  return { revision: upd.revision, status: nextStatus };
}

export async function setStatus(
  ctx: Ctx,
  input: { id: string; to: ProfileStatus; expectedRevision: number; reason?: string },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const cur = await loadProfile(ctx, input.id);
  const from = cur.status as ProfileStatus;
  if (!MANUAL_TRANSITIONS[from].includes(input.to))
    throw new Error("Transição de status não permitida.");
  if (input.to === "in_validation" && from !== "approved")
    throw new Error('Use "Solicitar validação" para enviar ao líder da equipe.');
  if (input.to === "in_validation" && from === "approved" && cur.ats_job_id)
    throw new Error("Perfil já encaminhado.");
  const { data: upd, error } = await ctx.supabase
    .from("deal_role_profiles")
    .update({ status: input.to, revision: cur.revision + 1, updated_at: new Date().toISOString() })
    .eq("id", cur.id)
    .eq("revision", input.expectedRevision)
    .select("revision")
    .maybeSingle();
  if (error) throw friendly(error);
  if (!upd)
    throw new Error("Outra pessoa alterou este perfil. Recarregue para ver a versão mais recente.");
  await logEvent(ctx, cur.id, "status_changed", {
    from_status: from,
    to_status: input.to,
    reason: input.reason?.slice(0, 500),
  });
  return { revision: upd.revision };
}

export async function approve(ctx: Ctx, input: { id: string; expectedRevision: number }) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.approve);
  const cur = await loadProfile(ctx, input.id);
  const like = rowToLike(cur);
  const missing = approvalMissing(like);
  if (missing.length) throw new Error(`Complete antes de aprovar: ${missing.join(", ")}.`);
  const { data, error } = await ctx.supabase.rpc("role_profile_approve", {
    _profile: cur.id,
    _expected_revision: input.expectedRevision,
    _snapshot: snapshotOf(like) as unknown as Json,
    _commercial: null as unknown as Json,
  });
  if (error) throw friendly(error);
  return data as { version_id: string; version: number };
}

async function approvedSnapshot(ctx: Ctx, p: ProfileRow): Promise<ProfileLike> {
  if (!p.approved_version_id) throw new Error("Aprove o perfil antes.");
  const { data } = await ctx.supabase
    .from("deal_role_profile_versions")
    .select("snapshot")
    .eq("id", p.approved_version_id)
    .maybeSingle();
  if (!data) throw new Error("Versão aprovada não encontrada.");
  const s = data.snapshot as unknown as ProfileLike;
  return { ...s, data: parseData(s.data) };
}

export async function forward(ctx: Ctx, input: { id: string; early: boolean; reason?: string }) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.forward);
  const p = await loadProfile(ctx, input.id);
  await loadDeal(ctx, p.deal_id); // visibilidade do negócio pelo usuário
  if (p.ats_job_id) return { atsJobId: p.ats_job_id, already: true };
  const snap = await approvedSnapshot(ctx, p);
  const { data, error } = await ctx.supabase.rpc("role_profile_forward", {
    _profile: p.id,
    _job: toAtsJob(snap) as unknown as Json,
    _early: input.early,
    _early_reason: input.reason ?? "",
  });
  if (error) throw friendly(error);
  const r = data as { ats_job_id: string; already: boolean };
  return { atsJobId: r.ats_job_id, already: r.already };
}

export async function syncAts(ctx: Ctx, id: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.forward);
  const p = await loadProfile(ctx, id);
  const snap = await approvedSnapshot(ctx, p);
  const { data, error } = await ctx.supabase.rpc("role_profile_sync_ats", {
    _profile: p.id,
    _job: toAtsJob(snap) as unknown as Json,
  });
  if (error) throw friendly(error);
  return data as { already: boolean; version: number };
}

export async function saveTemplate(ctx: Ctx, input: { profileId: string; name: string }) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.create);
  const p = await loadProfile(ctx, input.profileId);
  const t = toTemplatePayload(rowToLike(p));
  const { data, error } = await ctx.supabase
    .from("deal_role_profile_templates")
    .insert({
      workspace_id: ctx.workspaceId,
      name: input.name.trim().slice(0, 120),
      modality: t.header.modality,
      seniority: t.header.seniority ?? null,
      payload: t as unknown as Json,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw friendly(error);
  return { id: data.id };
}

export async function archive(ctx: Ctx, id: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const p = await loadProfile(ctx, id);
  if (p.ats_job_id)
    throw new Error("Perfil já encaminhado ao recrutamento não pode ser excluído.");
  const { data: done, error } = await ctx.supabase
    .from("deal_role_profiles")
    .update({ archived_at: new Date().toISOString(), revision: p.revision + 1 })
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) throw friendly(error);
  if (!done?.length) throw new Error("Você não tem permissão para excluir este perfil.");
  await logEvent(ctx, id, "archived");
  return { ok: true };
}

// ------------------------------ Link do cliente ------------------------------

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createShareLink(
  ctx: Ctx,
  input: { id: string; allowedFields: string[]; days: number; maxWrites: number },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.share);
  const p = await loadProfile(ctx, input.id);
  const allowed = sanitizeAllowedFields(input.allowedFields);
  if (!allowed.length) throw new Error("Selecione ao menos um campo para o cliente.");
  const token = randomToken();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("deal_role_profile_share_links")
    .insert({
      profile_id: p.id,
      workspace_id: ctx.workspaceId,
      base_revision: p.revision,
      token_hash: await sha256(token),
      allowed_fields: allowed,
      expires_at: new Date(
        Date.now() + Math.min(Math.max(input.days, 1), 30) * 86400_000,
      ).toISOString(),
      max_writes: Math.min(Math.max(input.maxWrites, 1), 20),
      created_by: ctx.userId,
    })
    .select("id, expires_at")
    .single();
  if (error) throw friendly(error);
  await logEvent(ctx, p.id, "share_link_created", {
    details: { link_id: data.id, fields: allowed } as Json,
  });
  // O token só é devolvido agora; o banco guarda apenas o hash.
  return { linkId: data.id, token, expiresAt: data.expires_at };
}

export async function revokeShareLink(ctx: Ctx, linkId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.share);
  const { data: link } = await ctx.supabase
    .from("deal_role_profile_share_links")
    .select("id, profile_id")
    .eq("id", linkId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!link) throw new Error("Link não encontrado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("deal_role_profile_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("workspace_id", ctx.workspaceId);
  await logEvent(ctx, link.profile_id, "share_link_revoked", {
    details: { link_id: linkId } as Json,
  });
  return { ok: true };
}

export async function reviewProposal(
  ctx: Ctx,
  input: { proposalId: string; action: "apply" | "reject"; expectedRevision: number },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const { data: prop } = await ctx.supabase
    .from("deal_role_profile_client_proposals")
    .select("id, profile_id, payload, status, link_id")
    .eq("id", input.proposalId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!prop) throw new Error("Proposta não encontrada.");
  if (prop.status !== "pending") throw new Error("Proposta já revisada.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (input.action === "apply") {
    const p = await loadProfile(ctx, prop.profile_id);
    const { data: link } = await supabaseAdmin
      .from("deal_role_profile_share_links")
      .select("allowed_fields")
      .eq("id", prop.link_id)
      .maybeSingle();
    const { applyClientProposal } = await import("./schema");
    const r = applyClientProposal(
      parseData(p.data),
      prop.payload,
      sanitizeAllowedFields(link?.allowed_fields ?? []),
    );
    if (!r.ok) throw new Error(r.error);
    const like = rowToLike(p);
    await saveProfile(ctx, {
      id: p.id,
      expectedRevision: input.expectedRevision,
      header: {
        title: like.title,
        quantity: like.quantity,
        modality: like.modality,
        priority: like.priority,
        seniority: like.seniority ?? null,
        contact_id: like.contact_id ?? null,
        assigned_to: p.assigned_to,
      },
      data: r.data,
    });
  }
  await supabaseAdmin
    .from("deal_role_profile_client_proposals")
    .update({
      status: input.action === "apply" ? "applied" : "rejected",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", prop.id)
    .eq("status", "pending");
  await logEvent(
    ctx,
    prop.profile_id,
    input.action === "apply" ? "client_proposal_applied" : "client_proposal_rejected",
    { details: { proposal_id: prop.id } as Json },
  );
  return { ok: true };
}

// ------------------------------ Anexos privados ------------------------------

export async function uploadAttachment(
  ctx: Ctx,
  input: { id: string; filename: string; base64: string },
  by: "user" | "client" = "user",
) {
  if (by === "user") await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const bin = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
  if (bin.byteLength === 0 || bin.byteLength > 10 * 1024 * 1024)
    throw new Error("Arquivo vazio ou acima de 10 MB.");
  const kind = sniff(bin);
  if (!kind) throw new Error("Formato não permitido. Use PDF, DOCX, PNG, JPG ou WebP.");
  const safeName = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
  const path = `${ctx.workspaceId}/${input.id}/${crypto.randomUUID()}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bin, { contentType: kind.mime, upsert: false });
  if (upErr) throw new Error("Falha ao enviar arquivo.");
  const { data, error } = await supabaseAdmin
    .from("deal_role_profile_attachments")
    .insert({
      profile_id: input.id,
      workspace_id: ctx.workspaceId,
      storage_path: path,
      filename: safeName,
      mime: kind.mime,
      size_bytes: bin.byteLength,
      uploaded_by: by === "user" ? ctx.userId : null,
      uploaded_by_kind: by,
    })
    .select("id")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    throw friendly(error);
  }
  return { id: data.id };
}

export async function attachmentUrl(ctx: Ctx, attachmentId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  // Leitura pelo cliente do usuário (RLS) prova acesso antes de assinar.
  const { data: a } = await ctx.supabase
    .from("deal_role_profile_attachments")
    .select("storage_path, filename")
    .eq("id", attachmentId)
    .eq("workspace_id", ctx.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!a) throw new Error("Anexo não encontrado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(a.storage_path, 60, { download: a.filename });
  if (error || !data) throw new Error("Não foi possível gerar o link do anexo.");
  return { url: data.signedUrl };
}

export async function removeAttachment(ctx: Ctx, attachmentId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const { data: a } = await ctx.supabase
    .from("deal_role_profile_attachments")
    .select("id, profile_id")
    .eq("id", attachmentId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!a) throw new Error("Anexo não encontrado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("deal_role_profile_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", attachmentId);
  await logEvent(ctx, a.profile_id, "attachment_removed", {
    details: { attachment_id: attachmentId } as Json,
  });
  return { ok: true };
}

/** Conversas do PRÓPRIO negócio, para o operador escolher explicitamente na importação. */
export async function listDealConversations(ctx: Ctx, dealId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.create);
  await loadDeal(ctx, dealId);
  const { data } = await ctx.supabase
    .from("activities")
    .select("id, type, subject, created_at")
    .eq("related_deal_id", dealId)
    .eq("workspace_id", ctx.workspaceId)
    .in("type", ["email", "note", "call", "meeting", "whatsapp"] as never)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Edição em lote e pré-preenchimento pelos itens de linha.

export async function listTitleOptions(ctx: Ctx) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  const [{ data: jps }, { data: presets }] = await Promise.all([
    ctx.supabase
      .from("job_profiles")
      .select("id, name, seniority")
      .eq("workspace_id", ctx.workspaceId)
      .eq("active", true)
      .order("name")
      .limit(1000),
    ctx.supabase
      .from("contracting_presets")
      .select("id, name, seniority, job_profile_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("active", true)
      .order("name")
      .limit(1000),
  ]);
  return {
    jobProfiles: jps ?? [],
    presets: presets ?? [],
  };
}

export async function createFromLines(ctx: Ctx, input: { dealId: string; lineItemIds: string[] }) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.create);
  const lines = await loadDealLines(ctx, input.dealId);
  const wanted = new Set(input.lineItemIds);
  const results: { lineItemId: string; id?: string; already?: boolean; error?: string }[] = [];
  for (const l of lines.filter((x) => wanted.has(x.id))) {
    const sug = suggestionFromLine(l);
    if (!sug) {
      results.push({ lineItemId: l.id, error: "Item sem serviço elegível ou sem cargo/preset." });
      continue;
    }
    try {
      const r = await createProfile(ctx, {
        dealId: input.dealId,
        header: {
          title: sug.title || "Perfil",
          quantity: sug.quantity,
          modality: sug.modality,
          priority: "medium",
          seniority: sug.seniority,
          contact_id: null,
          assigned_to: null,
        },
        links: {
          sourceLineItemId: l.id,
          jobProfileId: sug.jobProfileId ?? undefined,
          presetId: sug.presetId ?? undefined,
        },
      });
      results.push({ lineItemId: l.id, id: r.id, already: "already" in r ? !!r.already : false });
    } catch (e) {
      results.push({ lineItemId: l.id, error: (e as Error).message });
    }
  }
  return results;
}

/** Salva vários perfis; erro de um não impede os outros. */
export async function saveMany(
  ctx: Ctx,
  items: {
    id: string;
    expectedRevision: number;
    header: unknown;
    data: unknown;
    links?: { jobProfileId?: string | null; presetId?: string | null };
  }[],
) {
  const out: { id: string; revision?: number; status?: string; error?: string }[] = [];
  for (const it of items) {
    try {
      const r = await saveProfile(ctx, it);
      out.push({ id: it.id, revision: r.revision, status: r.status });
    } catch (e) {
      const err = e as Error & { issues?: { path: (string | number)[]; message: string }[] };
      const msg = err.issues?.length
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : err.message;
      out.push({ id: it.id, error: msg });
    }
  }
  return out;
}
