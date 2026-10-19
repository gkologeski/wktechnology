// Serviço server-only do importador Clockify: conexão cifrada, execuções, mapeamentos
// e consultas da tela. Toda ação exige admin ATIVO do workspace ativo; ações que
// gravam também bloqueiam o modo "Ver como" somente leitura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/provider-resolver.server";
import { ClockifyApiError, ClockifyClient, minIntervalForPlan } from "./clockify-client";
import { assertRegion, clockifyBases, isClockifyId, normalizeSubdomain, type ClockifyRegion } from "./clockify-urls";
import { normalizeEmail } from "./clockify-map";
import { ClockifyEngine, defaultOptions, type Db, type RunOptions } from "./clockify-engine.server";

const BAN_FOREVER = "876000h";
const LEASE_MS = 45_000;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type Ctx = { workspaceId: string; userId: string };

/** Admin ativo do workspace ativo (o servidor confere; a tela só esconde botões). */
export async function requireClockifyAdmin(
  supabase: SupabaseClient,
  userId: string,
  opts: { write: boolean },
): Promise<Ctx> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data, error } = await supabase.rpc("is_active_workspace_admin", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error || data !== true) {
    throw new Error("Apenas administradores ativos do workspace podem usar o importador do Clockify.");
  }
  if (opts.write) await assertNotReadOnlyView(supabase);
  return { workspaceId, userId };
}

type ConnRow = {
  id: string;
  key_ciphertext: string | null;
  key_last4: string | null;
  region: string;
  subdomain: string | null;
  source_workspace_id: string | null;
  source_workspace_name: string | null;
  source_plan: string | null;
  status: string;
  last_error: string | null;
  last_tested_at: string | null;
  updated_at: string;
};

async function loadConn(workspaceId: string): Promise<ConnRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("clockify_connections")
    .select(
      "id, key_ciphertext, key_last4, region, subdomain, source_workspace_id, source_workspace_name, source_plan, status, last_error, last_tested_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnRow | null) ?? null;
}

/** Visão segura da conexão: nunca devolve a chave, nem cifrada. */
export function maskConnection(c: ConnRow | null) {
  return {
    configured: !!c?.key_ciphertext,
    keyMasked: c?.key_last4 ? `••••••••${c.key_last4}` : null,
    region: (c?.region ?? "global") as ClockifyRegion,
    subdomain: c?.subdomain ?? null,
    status: c?.status ?? "not_configured",
    lastError: c?.last_error ?? null,
    lastTestedAt: c?.last_tested_at ?? null,
    source: c?.source_workspace_id
      ? { id: c.source_workspace_id, name: c.source_workspace_name, plan: c.source_plan }
      : null,
  };
}

async function clientFor(c: ConnRow, plan?: string | null) {
  if (!c.key_ciphertext) throw new Error("Cadastre a chave do Clockify antes de continuar.");
  const apiKey = await decryptApiKey(c.key_ciphertext);
  return new ClockifyClient({
    apiKey,
    bases: clockifyBases(assertRegion(c.region), c.subdomain),
    minIntervalMs: Math.min(minIntervalForPlan(plan ?? c.source_plan), 2000),
    maxInlineWaitMs: 5000,
  });
}

export async function getClockifyStatus(ctx: Ctx) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  const { data: runs } = await db
    .from("clockify_import_runs")
    .select("id, kind, status, phase, counts, error, created_at, started_at, finished_at, preview_confirmed_at, source_workspace_id, options")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);
  return {
    connection: maskConnection(conn),
    encryptionReady: !!process.env["AI_KEYS_ENCRYPTION_KEY"],
    runs: runs ?? [],
  };
}

export async function saveClockifyConnection(
  ctx: Ctx,
  input: { apiKey?: string; region: string; subdomain?: string | null },
) {
  const region = assertRegion(input.region);
  const subdomain = normalizeSubdomain(input.subdomain ?? null);
  const db = await admin();
  const current = await loadConn(ctx.workspaceId);
  const patch: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    region,
    subdomain,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };
  const key = input.apiKey?.trim();
  if (key) {
    if (!/^[A-Za-z0-9+/=_-]{20,200}$/.test(key)) {
      throw new Error("Chave do Clockify em formato inválido. Copie a chave completa em Profile settings › API.");
    }
    patch.key_ciphertext = await encryptApiKey(key);
    patch.key_last4 = key.slice(-4);
    patch.status = "configured";
    patch.last_error = null;
  } else if (!current?.key_ciphertext) {
    throw new Error("Informe a chave de API do Clockify.");
  }
  // Mudou região/subdomínio: a origem escolhida precisa ser confirmada de novo.
  if (current && (current.region !== region || (current.subdomain ?? null) !== subdomain)) {
    patch.source_workspace_id = null;
    patch.source_workspace_name = null;
    patch.source_plan = null;
    patch.status = "configured";
  }
  if (!current) patch.created_by = ctx.userId;
  const { error } = await db.from("clockify_connections").upsert(patch, { onConflict: "workspace_id" });
  if (error) throw new Error(error.message);
  return maskConnection(await loadConn(ctx.workspaceId));
}

export async function removeClockifyConnection(ctx: Ctx) {
  const db = await admin();
  const { error } = await db
    .from("clockify_connections")
    .update({
      key_ciphertext: null,
      key_last4: null,
      status: "not_configured",
      last_error: null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

type CkWorkspace = { id: string; name: string; featureSubscriptionType?: string | null; subdomain?: unknown };

/** Testa a chave (somente GET) e lista os workspaces que ela enxerga. */
export async function testClockifyConnection(ctx: Ctx) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.key_ciphertext) throw new Error("Cadastre a chave do Clockify antes de testar.");
  await db.from("clockify_connections").update({ status: "connecting" }).eq("id", conn.id);
  const now = new Date().toISOString();
  try {
    const client = await clientFor(conn, null);
    const { data: me } = await client.get<{ id?: string; name?: string; activeWorkspace?: string }>("/user");
    const { data: wss } = await client.get<CkWorkspace[]>("/workspaces");
    const workspaces = (Array.isArray(wss) ? wss : [])
      .filter((w) => isClockifyId(w.id))
      .map((w) => ({ id: w.id, name: w.name, plan: w.featureSubscriptionType ?? null }));
    await db
      .from("clockify_connections")
      .update({ status: "connected", last_error: null, last_tested_at: now })
      .eq("id", conn.id);
    return { ok: true, userName: me?.name ?? null, workspaces };
  } catch (e) {
    const msg = e instanceof ClockifyApiError ? e.message : "Falha ao testar a conexão com o Clockify.";
    await db
      .from("clockify_connections")
      .update({ status: "failed", last_error: msg, last_tested_at: now })
      .eq("id", conn.id);
    return { ok: false, message: msg, workspaces: [] as Array<{ id: string; name: string; plan: string | null }> };
  }
}

export async function selectClockifySource(ctx: Ctx, sourceWorkspaceId: string) {
  if (!isClockifyId(sourceWorkspaceId)) throw new Error("Workspace de origem inválido.");
  const tested = await testClockifyConnection(ctx);
  if (!tested.ok) throw new Error(tested.message ?? "Conexão indisponível.");
  const ws = tested.workspaces.find((w) => w.id.toLowerCase() === sourceWorkspaceId.toLowerCase());
  if (!ws) throw new Error("A chave não tem acesso a esse workspace do Clockify.");
  const db = await admin();
  const { error } = await db
    .from("clockify_connections")
    .update({
      source_workspace_id: ws.id.toLowerCase(),
      source_workspace_name: ws.name,
      source_plan: ws.plan,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId);
  if (error) throw new Error(error.message);
  return maskConnection(await loadConn(ctx.workspaceId));
}

// ------------------------------------------------------------------ execuções
export async function startClockifyRun(
  ctx: Ctx,
  input: { kind: "dry_run" | "import"; options?: Partial<RunOptions>; previewRunId?: string },
) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.key_ciphertext || conn.status !== "connected" || !conn.source_workspace_id) {
    throw new Error("Conecte o Clockify e escolha o workspace de origem antes de começar.");
  }
  let options = defaultOptions(input.options);
  let previewRunId: string | null = null;
  if (input.kind === "import") {
    if (!input.previewRunId) throw new Error("Escolha a prévia conferida.");
    const { data: pv } = await db
      .from("clockify_import_runs")
      .select("id, kind, status, source_workspace_id, preview_confirmed_at, finished_at, options")
      .eq("id", input.previewRunId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!pv || pv.kind !== "dry_run" || pv.status !== "completed" || !pv.preview_confirmed_at) {
      throw new Error("A importação só começa a partir de uma prévia concluída e conferida.");
    }
    if (pv.source_workspace_id !== conn.source_workspace_id) {
      throw new Error("A prévia é de outro workspace de origem. Gere uma nova prévia.");
    }
    const { data: latest } = await db
      .from("clockify_import_runs")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("kind", "dry_run")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id !== pv.id) throw new Error("Existe uma prévia mais recente. Confira e confirme a última.");
    const { count } = await db
      .from("clockify_mappings")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("source_workspace_id", conn.source_workspace_id)
      .gt("updated_at", pv.finished_at as string);
    if ((count ?? 0) > 0) throw new Error("Mapeamentos mudaram depois da prévia. Gere uma nova prévia.");
    options = defaultOptions({ ...(pv.options as Partial<RunOptions>), refetch: false });
    previewRunId = pv.id;
  }
  const { data, error } = await db
    .from("clockify_import_runs")
    .insert({
      workspace_id: ctx.workspaceId,
      source_workspace_id: conn.source_workspace_id,
      kind: input.kind,
      status: "queued",
      phase: "start",
      options,
      requested_by: ctx.userId,
      preview_run_id: previewRunId,
    })
    .select("id")
    .single();
  if (error) {
    if (/clockify_import_runs_one_active/.test(error.message)) {
      throw new Error("Já existe uma execução em andamento. Aguarde, retome ou cancele antes de iniciar outra.");
    }
    throw new Error(error.message);
  }
  return { runId: data.id as string };
}

async function memberEmails(userIds: string[]) {
  const db = await admin();
  const map = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 10) {
    await Promise.all(
      userIds.slice(i, i + 10).map(async (id) => {
        const r = await db.auth.admin.getUserById(id).catch(() => null);
        const e = normalizeEmail(r?.data?.user?.email ?? null);
        if (e) map.set(id, e);
      }),
    );
  }
  return map;
}

/** Avança uma execução com trava (lease): duas abas ou o cron não processam juntos. */
export async function advanceClockifyRun(workspaceId: string, runId: string) {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data: claimed, error } = await db
    .from("clockify_import_runs")
    .update({ lease_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "running", "cancel_requested"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!claimed) return { advanced: false };
  try {
    if (claimed.status === "cancel_requested") {
      await db
        .from("clockify_import_runs")
        .update({ status: "cancelled", finished_at: nowIso })
        .eq("id", runId);
      return { advanced: true };
    }
    const conn = await loadConn(workspaceId);
    if (!conn?.key_ciphertext) {
      await db
        .from("clockify_import_runs")
        .update({ status: "paused", error: "Chave do Clockify removida. Cadastre de novo para retomar." })
        .eq("id", runId);
      return { advanced: false };
    }
    const engine = new ClockifyEngine({
      db,
      apiKey: await decryptApiKey(conn.key_ciphertext),
      region: assertRegion(conn.region),
      subdomain: conn.subdomain,
      plan: conn.source_plan,
      memberEmails,
    });
    await engine.advance(claimed as never);
    return { advanced: true };
  } finally {
    await db.from("clockify_import_runs").update({ lease_until: null }).eq("id", runId);
  }
}

export async function setClockifyRunState(ctx: Ctx, runId: string, action: "cancel" | "pause" | "resume") {
  const db = await admin();
  const next =
    action === "cancel" ? "cancel_requested" : action === "pause" ? "paused" : "running";
  const from = action === "resume" ? ["paused", "failed"] : ["queued", "running", "paused"];
  const { data, error } = await db
    .from("clockify_import_runs")
    .update({ status: next, error: null, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .in("status", from)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esta execução não pode mudar para esse estado agora.");
  return { ok: true };
}

export async function confirmClockifyPreview(ctx: Ctx, runId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("clockify_import_runs")
    .update({ preview_confirmed_at: new Date().toISOString(), preview_confirmed_by: ctx.userId })
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("kind", "dry_run")
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Só é possível confirmar uma prévia concluída.");
  return { ok: true };
}

export async function getClockifyRun(ctx: Ctx, runId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("clockify_import_runs")
    .select("id, kind, status, phase, counts, report, error, created_at, started_at, finished_at, heartbeat_at, preview_confirmed_at, options, checkpoint")
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Execução não encontrada.");
  const cp = (data.checkpoint ?? {}) as { waitUntil?: number; index?: number; ids?: string[]; page?: number };
  return {
    ...data,
    checkpoint: undefined,
    progress: {
      waitUntil: cp.waitUntil ?? null,
      index: cp.index ?? null,
      total: cp.ids?.length ?? null,
      page: cp.page ?? null,
    },
  };
}

// ------------------------------------------------------------------ mapeamentos e staging
export async function listClockifyMappings(ctx: Ctx, entity: "user" | "client" | "project") {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.source_workspace_id) return { rows: [] };
  const { data, error } = await db
    .from("clockify_mappings")
    .select("external_id, label, target_id, method, decision, candidates, note, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_workspace_id", conn.source_workspace_id)
    .eq("entity_type", entity)
    .order("label")
    .limit(1000);
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
}

export async function setClockifyMapping(
  ctx: Ctx,
  input: { entity: "user" | "client" | "project"; externalId: string; decision: "confirmed" | "ignore" | "create" | "pending"; targetId?: string | null },
) {
  if (!isClockifyId(input.externalId)) throw new Error("Identificador inválido.");
  if (input.entity !== "project" && input.decision === "create") throw new Error("Decisão inválida.");
  if (input.decision === "confirmed" && !input.targetId) throw new Error("Escolha o registro de destino.");
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.source_workspace_id) throw new Error("Escolha o workspace de origem.");
  const { data, error } = await db
    .from("clockify_mappings")
    .update({
      decision: input.decision,
      target_id: input.decision === "confirmed" ? input.targetId : null,
      method: input.decision === "confirmed" ? "manual" : "none",
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_workspace_id", conn.source_workspace_id)
    .eq("entity_type", input.entity)
    .eq("external_id", input.externalId.toLowerCase())
    .select("external_id")
    .maybeSingle();
  if (error) throw new Error(/fora do workspace/.test(error.message) ? "Destino não pertence a este workspace." : error.message);
  if (!data) throw new Error("Mapeamento não encontrado. Gere uma prévia primeiro.");
  return { ok: true };
}

export async function clockifyTargetOptions(ctx: Ctx, entity: "user" | "client" | "project", q: string) {
  const db = await admin();
  const term = q.replace(/[%_\\,()]/g, "").trim();
  if (entity === "user") {
    const { data: members } = await db
      .from("workspace_members")
      .select("user_id, status")
      .eq("workspace_id", ctx.workspaceId)
      .limit(1000);
    const ids = (members ?? []).map((m) => m.user_id as string);
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]));
    return (members ?? [])
      .map((m) => ({ id: m.user_id as string, label: names.get(m.user_id as string) ?? "Sem nome", status: m.status as string }))
      .filter((o) => !term || o.label.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 50);
  }
  if (entity === "client") {
    let qb = db.from("companies").select("id, name").eq("workspace_id", ctx.workspaceId).order("name").limit(30);
    if (term) qb = qb.ilike("name", `%${term}%`);
    const { data } = await qb;
    return (data ?? []).map((c) => ({ id: c.id as string, label: c.name as string, status: null }));
  }
  let qb = db.from("projects").select("id, name, status").eq("workspace_id", ctx.workspaceId).order("name").limit(30);
  if (term) qb = qb.ilike("name", `%${term}%`);
  const { data } = await qb;
  return (data ?? []).map((p) => ({ id: p.id as string, label: p.name as string, status: p.status as string }));
}

export async function listClockifyStaging(
  ctx: Ctx,
  input: { entity: string; status?: string | null; reason?: string | null; page: number },
) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.source_workspace_id) return { rows: [], total: 0 };
  const size = 50;
  let qb = db
    .from("clockify_staging_records")
    .select("external_id, entity_type, status, reason_code, reason_detail, last_seen_at, payload", { count: "exact" })
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_workspace_id", conn.source_workspace_id)
    .eq("entity_type", input.entity)
    .order("external_id")
    .range(input.page * size, input.page * size + size - 1);
  if (input.status) qb = qb.eq("status", input.status);
  if (input.reason) qb = qb.eq("reason_code", input.reason);
  const { data, count, error } = await qb;
  if (error) throw new Error(error.message);
  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => {
      const p = r.payload as Record<string, unknown> & { timeInterval?: { start?: string; end?: string | null } };
      return {
        externalId: r.external_id as string,
        status: r.status as string,
        reason: r.reason_code as string | null,
        detail: r.reason_detail as string | null,
        lastSeenAt: r.last_seen_at as string,
        summary: {
          name: (p.name as string | undefined) ?? null,
          description: typeof p.description === "string" ? p.description.slice(0, 140) : null,
          userId: (p.userId as string | undefined) ?? null,
          projectId: (p.projectId as string | undefined) ?? null,
          start: p.timeInterval?.start ?? null,
          end: p.timeInterval?.end ?? null,
        },
      };
    }),
  };
}

/**
 * Identidade histórica: mesmo modelo dos responsáveis importados do HubSpot (conta
 * banida + membro inativo). Só por ação explícita do admin; não envia convite, não
 * ativa acesso e não copia papéis do Clockify.
 */
export async function createClockifyHistoricalIdentity(ctx: Ctx, externalId: string) {
  if (!isClockifyId(externalId)) throw new Error("Identificador inválido.");
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.source_workspace_id) throw new Error("Escolha o workspace de origem.");
  const { data: st } = await db
    .from("clockify_staging_records")
    .select("payload")
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_workspace_id", conn.source_workspace_id)
    .eq("entity_type", "user")
    .eq("external_id", externalId.toLowerCase())
    .maybeSingle();
  const payload = (st?.payload ?? null) as { email?: string; name?: string } | null;
  const email = normalizeEmail(payload?.email ?? null);
  if (!email) throw new Error("A pessoa não tem e-mail válido no Clockify; vincule manualmente.");
  const fullName = payload?.name?.trim() || email;
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    ban_duration: BAN_FOREVER,
    user_metadata: { full_name: fullName, source: "clockify" },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      "Não foi possível criar a identidade histórica (o e-mail já pode estar em uso na plataforma). Vincule a um membro existente.",
    );
  }
  const newId = created.data.user.id;
  await db.from("profiles").upsert({ id: newId, full_name: fullName }, { onConflict: "id" });
  const { error: mErr } = await db
    .from("workspace_members")
    .insert({ workspace_id: ctx.workspaceId, user_id: newId, role: "member", status: "inactive" });
  if (mErr) throw new Error(mErr.message);
  const { error } = await db
    .from("clockify_mappings")
    .update({ target_id: newId, decision: "confirmed", method: "created", decided_by: ctx.userId, decided_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_workspace_id", conn.source_workspace_id)
    .eq("entity_type", "user")
    .eq("external_id", externalId.toLowerCase());
  if (error) throw new Error(error.message);
  return { ok: true };
}
