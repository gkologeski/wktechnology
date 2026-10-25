// Serviço server-only do importador Jibble: conexão cifrada, execuções e consultas da tela.
// Toda ação exige admin ATIVO do workspace ativo; ações que gravam bloqueiam "Ver como".
// client_id/client_secret ficam cifrados (AI_KEYS_ENCRYPTION_KEY) e nunca voltam ao navegador.
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/provider-resolver.server";
import { clockifyTargetOptions } from "../clockify/clockify-service.server";
import { JibbleApiError, JibbleClient, type JibbleCredentials } from "./jibble-client";
import { defaultJbOptions, JibbleEngine, type JbRunOptions } from "./jibble-engine.server";
import { canReadWholeOrg, classifyJibbleRole, type JbAccess } from "./jibble-map";
import { createJibbleStore } from "./jibble-store.server";
import type { RunRow } from "./jibble-store";
import { buildJibbleUrl, isJibbleId } from "./jibble-urls";

const LEASE_MS = 45_000;
const PROVIDER = "jibble";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;
export type Ctx = { workspaceId: string; userId: string };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export async function requireJibbleAdmin(
  supabase: SupabaseClient,
  userId: string,
  opts: { write: boolean },
): Promise<Ctx> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { workRpc } = await import("@/lib/access-control/work-core.server");
  await workRpc(supabase, "work_area_authorize", {
    r: "techprojects.jibble_import",
    a: opts.write ? "manage" : "view",
    i: null,
  });
  const { data, error } = await supabase.rpc("is_active_workspace_admin", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error || data !== true)
    throw new Error(
      "Apenas administradores ativos do workspace podem usar o importador do Jibble.",
    );
  if (opts.write) await assertNotReadOnlyView(supabase);
  return { workspaceId, userId };
}

type ConnRow = {
  id: string;
  credentials_ciphertext: string | null;
  client_id_hint: string | null;
  secret_last4: string | null;
  source_org_id: string | null;
  source_org_name: string | null;
  source_person_id: string | null;
  source_role: string | null;
  source_access: string | null;
  source_verified_at: string | null;
  status: string;
  last_error: string | null;
  last_tested_at: string | null;
};

async function loadConn(workspaceId: string): Promise<ConnRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("time_import_connections")
    .select(
      "id, credentials_ciphertext, client_id_hint, secret_last4, source_org_id, source_org_name, source_person_id, source_role, source_access, source_verified_at, status, last_error, last_tested_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnRow | null) ?? null;
}

/** Visão segura: nunca devolve credencial, nem cifrada. */
export function maskJibbleConnection(c: ConnRow | null) {
  return {
    configured: !!c?.credentials_ciphertext,
    clientIdMasked: c?.client_id_hint ? `••••${c.client_id_hint}` : null,
    // Do segredo nunca se mostra nenhum caractere.
    secretMasked: c?.secret_last4 ? "••••••••" : null,
    status: c?.status ?? "not_configured",
    lastError: c?.last_error ?? null,
    lastTestedAt: c?.last_tested_at ?? null,
    org: c?.source_org_id
      ? {
          id: c.source_org_id,
          name: c.source_org_name,
          role: c.source_role,
          access: (c.source_access ?? "unknown") as JbAccess,
          confirmedAt: c.source_verified_at,
        }
      : null,
  };
}

async function credentialsOf(c: ConnRow): Promise<JibbleCredentials> {
  if (!c.credentials_ciphertext)
    throw new Error("Cadastre as credenciais do Jibble antes de continuar.");
  const parsed = JSON.parse(await decryptApiKey(c.credentials_ciphertext)) as JibbleCredentials;
  return parsed;
}

export async function getJibbleStatus(ctx: Ctx) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  const { data: runs } = await db
    .from("time_import_runs")
    .select(
      "id, kind, status, phase, counts, report, error, created_at, started_at, finished_at, preview_confirmed_at, source_org_id, target_run_id",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    connection: maskJibbleConnection(conn),
    encryptionReady: !!process.env["AI_KEYS_ENCRYPTION_KEY"],
    runs: runs ?? [],
  };
}

export async function saveJibbleConnection(
  ctx: Ctx,
  input: { clientId: string; clientSecret: string },
) {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (clientId.length < 8 || clientSecret.length < 8)
    throw new Error("Informe o Client ID e o Client Secret completos.");
  const db = await admin();
  const ciphertext = await encryptApiKey(JSON.stringify({ clientId, clientSecret }));
  const { error } = await db.from("time_import_connections").upsert(
    {
      workspace_id: ctx.workspaceId,
      provider: PROVIDER,
      credentials_ciphertext: ciphertext,
      client_id_hint: clientId.slice(-4),
      secret_last4: clientSecret.slice(-4),
      status: "configured",
      last_error: null,
      // Nova credencial apaga a comprovação anterior de organização/papel.
      source_org_id: null,
      source_org_name: null,
      source_person_id: null,
      source_role: null,
      source_access: null,
      source_verified_at: null,
      updated_by: ctx.userId,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removeJibbleConnection(ctx: Ctx) {
  const db = await admin();
  const { error } = await db
    .from("time_import_connections")
    .update({
      credentials_ciphertext: null,
      client_id_hint: null,
      secret_last4: null,
      status: "not_configured",
      source_access: null,
      source_verified_at: null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Só leitura: token, organização e papel de quem criou as credenciais. */
export async function testJibbleConnection(ctx: Ctx) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.credentials_ciphertext) throw new Error("Cadastre as credenciais do Jibble primeiro.");
  const now = new Date().toISOString();
  try {
    const client = new JibbleClient({
      credentials: await credentialsOf(conn),
      maxInlineWaitMs: 5000,
    });
    const info = await client.authenticate();
    const orgs = (
      await client.page<{ id: string; name?: string }>(
        buildJibbleUrl("workspace", "/v1/Organizations"),
      )
    ).items;
    const org =
      orgs.find((o) => o.id === info.organizationId) ?? (orgs.length === 1 ? orgs[0] : null);
    let role: string | null = null;
    let personName: string | null = null;
    if (info.personId && isJibbleId(info.personId)) {
      const people = await client.page<{ role?: string; fullName?: string }>(
        buildJibbleUrl("workspace", "/v1/People", {
          $filter: `id eq ${info.personId}`,
          $select: "id,fullName,role,status",
        }),
      );
      role = people.items[0]?.role ?? null;
      personName = people.items[0]?.fullName ?? null;
    }
    const access = classifyJibbleRole(role);
    const sameOrg = org && conn.source_org_id === org.id;
    await db
      .from("time_import_connections")
      .update({
        status: org ? "connected" : "failed",
        last_error: org ? null : "Nenhuma organização retornada pelo Jibble.",
        last_tested_at: now,
        source_org_id: org?.id ?? null,
        source_org_name: org?.name ?? null,
        source_person_id: info.personId,
        source_role: role,
        source_access: access,
        // Confirmação manual da origem só vale para a mesma organização e com acesso comprovado.
        source_verified_at: sameOrg && canReadWholeOrg(access) ? conn.source_verified_at : null,
        updated_at: now,
      })
      .eq("id", conn.id);
    return {
      ok: !!org,
      org: org ? { id: org.id, name: org.name ?? null } : null,
      orgCount: orgs.length,
      role,
      access,
      personName,
      requests: client.requests,
    };
  } catch (e) {
    const message =
      e instanceof JibbleApiError ? e.message : "Falha ao testar a conexão com o Jibble.";
    await db
      .from("time_import_connections")
      .update({
        status: "failed",
        last_error: message,
        last_tested_at: now,
        source_verified_at: null,
      })
      .eq("id", conn.id);
    return { ok: false, message };
  }
}

/** Confirma a organização pelo ID exibido no teste; exige proprietário/admin comprovado. */
export async function confirmJibbleSource(ctx: Ctx, orgId: string) {
  if (!isJibbleId(orgId)) throw new Error("Identificador inválido.");
  const conn = await loadConn(ctx.workspaceId);
  if (!conn || conn.status !== "connected" || conn.source_org_id !== orgId)
    throw new Error("Teste a conexão e confirme a organização exibida.");
  if (!canReadWholeOrg(conn.source_access as JbAccess))
    throw new Error(
      "As credenciais não comprovaram papel de proprietário ou administrador no Jibble.",
    );
  const db = await admin();
  const { error } = await db
    .from("time_import_connections")
    .update({ source_verified_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", conn.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function startJibbleRun(
  ctx: Ctx,
  input: {
    kind: "dry_run" | "import" | "rollback";
    options?: Partial<JbRunOptions> & { refetch?: boolean };
    previewRunId?: string;
    targetRunId?: string;
  },
) {
  const db = await admin();
  const conn = await loadConn(ctx.workspaceId);
  if (
    !conn?.credentials_ciphertext ||
    conn.status !== "connected" ||
    !conn.source_org_id ||
    !conn.source_verified_at
  )
    throw new Error("Conecte o Jibble, teste e confirme a organização antes de começar.");
  if (!canReadWholeOrg(conn.source_access as JbAccess))
    throw new Error("Acesso de proprietário/administrador no Jibble não comprovado.");
  let options: Record<string, unknown> = {
    ...defaultJbOptions(input.options),
    refetch: input.options?.refetch ?? true,
  };
  let previewRunId: string | null = null;
  let targetRunId: string | null = null;
  if (input.kind === "import") {
    const { data: pv } = await db
      .from("time_import_runs")
      .select("id, kind, status, source_org_id, preview_confirmed_at, finished_at, options")
      .eq("id", input.previewRunId ?? "")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (!pv || pv.kind !== "dry_run" || pv.status !== "completed" || !pv.preview_confirmed_at)
      throw new Error("A importação só começa a partir de uma prévia concluída e conferida.");
    if (pv.source_org_id !== conn.source_org_id)
      throw new Error("A prévia é de outra organização.");
    for (const table of ["time_import_mappings", "time_import_duplicates"]) {
      const { count } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspaceId)
        .eq("provider", PROVIDER)
        .eq("source_org_id", conn.source_org_id)
        .gt("updated_at", pv.finished_at as string);
      if ((count ?? 0) > 0)
        throw new Error(
          "Mapeamentos ou duplicidades mudaram depois da prévia. Recalcule a prévia.",
        );
    }
    options = { ...(pv.options as Record<string, unknown>), refetch: false };
    previewRunId = pv.id as string;
  }
  if (input.kind === "rollback") {
    const { data: tr } = await db
      .from("time_import_runs")
      .select("id, kind, status")
      .eq("id", input.targetRunId ?? "")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (
      !tr ||
      tr.kind !== "import" ||
      !["completed", "failed", "cancelled"].includes(tr.status as string)
    )
      throw new Error("Só é possível desfazer uma importação encerrada deste workspace.");
    targetRunId = tr.id as string;
  }
  const { data, error } = await db
    .from("time_import_runs")
    .insert({
      workspace_id: ctx.workspaceId,
      provider: PROVIDER,
      source_org_id: conn.source_org_id,
      kind: input.kind,
      status: "queued",
      phase: "start",
      options,
      requested_by: ctx.userId,
      preview_run_id: previewRunId,
      target_run_id: targetRunId,
      checkpoint: options.refetch === false && input.kind === "dry_run" ? { skipFetch: true } : {},
    })
    .select("id")
    .single();
  if (error) {
    if (/time_import_runs_one_active/.test(error.message))
      throw new Error("Já existe uma execução do Jibble em andamento. Aguarde, retome ou cancele.");
    throw new Error(error.message);
  }
  return { runId: data.id as string };
}

/** Avança com trava (lease): duas abas ou o cron não processam a mesma execução juntos. */
export async function advanceJibbleRun(workspaceId: string, runId: string) {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data: claimed, error } = await db
    .from("time_import_runs")
    .update({ lease_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .in("status", ["queued", "running", "cancel_requested"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!claimed) return { advanced: false };
  try {
    if (claimed.status === "cancel_requested") {
      await db
        .from("time_import_runs")
        .update({ status: "cancelled", finished_at: nowIso })
        .eq("id", runId);
      return { advanced: true };
    }
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const allowed = await workRpc<boolean>(db, "work_import_delegate_allowed", {
      p_ws: workspaceId,
      p_actor: claimed.delegation_authorized_by ?? claimed.requested_by,
      p_provider: "jibble",
    });
    if (!allowed) {
      await db
        .from("time_import_runs")
        .update({
          status: "paused",
          error:
            "Permissão do solicitante revogada. Um administrador autorizado deve retomar a importação.",
        })
        .eq("id", runId)
        .eq("workspace_id", workspaceId);
      return { advanced: false };
    }
    const conn = await loadConn(workspaceId);
    if (!conn?.credentials_ciphertext || conn.source_org_id !== claimed.source_org_id) {
      await db
        .from("time_import_runs")
        .update({
          status: "paused",
          error: "Credenciais removidas ou organização trocada. Reconecte para retomar.",
        })
        .eq("id", runId);
      return { advanced: false };
    }
    const engine = new JibbleEngine({
      store: createJibbleStore(db, workspaceId, claimed.source_org_id as string),
      client: new JibbleClient({ credentials: await credentialsOf(conn), maxInlineWaitMs: 8000 }),
    });
    const res = await engine.advance(claimed as unknown as RunRow);
    return { advanced: true, ...res };
  } finally {
    await db.from("time_import_runs").update({ lease_until: null }).eq("id", runId);
  }
}

export async function setJibbleRunState(
  ctx: Ctx,
  runId: string,
  action: "cancel" | "pause" | "resume",
) {
  const db = await admin();
  const next = action === "cancel" ? "cancel_requested" : action === "pause" ? "paused" : "running";
  const from = action === "resume" ? ["paused", "failed"] : ["queued", "running", "paused"];
  const { data, error } = await db
    .from("time_import_runs")
    .update({
      status: next,
      error: null,
      updated_at: new Date().toISOString(),
      ...(action === "resume"
        ? {
            delegation_authorized_by: ctx.userId,
            delegation_authorized_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .in("status", from)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esta execução não pode mudar para esse estado agora.");
  return { ok: true };
}

export async function confirmJibblePreview(ctx: Ctx, runId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("time_import_runs")
    .update({ preview_confirmed_at: new Date().toISOString(), preview_confirmed_by: ctx.userId })
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .eq("kind", "dry_run")
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Só é possível confirmar uma prévia concluída.");
  return { ok: true };
}

async function orgOf(ctx: Ctx): Promise<string> {
  const conn = await loadConn(ctx.workspaceId);
  if (!conn?.source_org_id) throw new Error("Conecte e confirme a organização do Jibble.");
  return conn.source_org_id;
}

export async function listJibbleMappings(ctx: Ctx, entity: "person" | "client" | "project") {
  const db = await admin();
  const { data, error } = await db
    .from("time_import_mappings")
    .select("external_id, label, target_id, method, decision, candidates, note")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .eq("source_org_id", await orgOf(ctx))
    .eq("entity_type", entity)
    .order("label")
    .limit(5000);
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
}

export async function setJibbleMapping(
  ctx: Ctx,
  input: {
    entity: "person" | "client" | "project";
    externalId: string;
    decision: "confirmed" | "ignore" | "create" | "pending";
    targetId?: string | null;
  },
) {
  if (input.decision === "create" && input.entity !== "project")
    throw new Error("Só projetos podem ser criados a partir do Jibble.");
  if (input.decision === "confirmed" && !input.targetId) throw new Error("Escolha o destino.");
  const db = await admin();
  const { data, error } = await db
    .from("time_import_mappings")
    .update({
      decision: input.decision,
      target_id: input.decision === "confirmed" ? input.targetId : null,
      method: input.decision === "confirmed" ? "manual" : "none",
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .eq("source_org_id", await orgOf(ctx))
    .eq("entity_type", input.entity)
    .eq("external_id", input.externalId.toLowerCase())
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mapeamento não encontrado.");
  return { ok: true };
}

export async function jibbleTargetOptions(
  ctx: Ctx,
  entity: "person" | "client" | "project",
  q: string,
) {
  return clockifyTargetOptions(ctx, entity === "person" ? "user" : entity, q);
}

export async function listJibbleStaging(
  ctx: Ctx,
  input: { entity: string; status?: string | null; reason?: string | null; page: number },
) {
  const db = await admin();
  let q = db
    .from("time_import_staging")
    .select(
      "external_id, status, reason_code, reason_detail, period, person_external_id, payload",
      { count: "exact" },
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .eq("source_org_id", await orgOf(ctx))
    .eq("entity_type", input.entity);
  if (input.status) q = q.eq("status", input.status);
  if (input.reason) q = q.eq("reason_code", input.reason);
  const from = input.page * 50;
  const { data, error, count } = await q
    .order("period", { ascending: false, nullsFirst: false })
    .range(from, from + 49);
  if (error) throw new Error(error.message);
  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      return {
        externalId: r.external_id as string,
        status: r.status as string,
        reason: (r.reason_code as string | null) ?? null,
        detail: (r.reason_detail as string | null) ?? null,
        period: (r.period as string | null) ?? null,
        person: (r.person_external_id as string | null) ?? null,
        summary: {
          name: (p.name ?? p.fullName ?? null) as string | null,
          type: (p.type ?? p.kind ?? null) as string | null,
          seconds: (p.seconds ?? null) as number | null,
          projectId: (p.projectId ?? null) as string | null,
          // Observação curta; coordenadas/endereços não saem do servidor.
          note: typeof p.note === "string" ? p.note.slice(0, 140) : null,
        },
      };
    }),
  };
}

export async function listJibbleDuplicates(
  ctx: Ctx,
  input: { decision: string | null; page: number },
) {
  const db = await admin();
  let q = db
    .from("time_import_duplicates")
    .select(
      "id, external_id, segment, existing_entry_id, existing_source, overlap_seconds, kind, decision",
      { count: "exact" },
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .eq("source_org_id", await orgOf(ctx));
  if (input.decision) q = q.eq("decision", input.decision);
  const from = input.page * 50;
  const { data, error, count } = await q.order("created_at").range(from, from + 49);
  if (error) throw new Error(error.message);
  type Existing = {
    entry_date: string | null;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    project_id: string | null;
  };
  const entryIds = [...new Set((data ?? []).map((d) => d.existing_entry_id as string))];
  const byId = new Map<string, Existing>();
  if (entryIds.length) {
    const { data: entries } = await db
      .from("project_time_entries")
      .select("id, entry_date, start_time, end_time, duration_minutes, project_id")
      .eq("workspace_id", ctx.workspaceId)
      .in("id", entryIds);
    for (const e of entries ?? [])
      byId.set(e.id as string, {
        entry_date: (e.entry_date as string | null) ?? null,
        start_time: (e.start_time as string | null) ?? null,
        end_time: (e.end_time as string | null) ?? null,
        duration_minutes: (e.duration_minutes as number | null) ?? null,
        project_id: (e.project_id as string | null) ?? null,
      });
  }
  return {
    total: count ?? 0,
    rows: (data ?? []).map((d) => ({
      id: d.id as string,
      externalId: d.external_id as string,
      segment: d.segment as number,
      existingEntryId: d.existing_entry_id as string,
      existingSource: (d.existing_source as string | null) ?? null,
      overlapSeconds: d.overlap_seconds as number,
      kind: d.kind as "exact" | "overlap",
      decision: d.decision as "pending" | "same_event" | "distinct",
      existing: byId.get(d.existing_entry_id as string) ?? null,
    })),
  };
}

export async function decideJibbleDuplicate(
  ctx: Ctx,
  id: string,
  decision: "same_event" | "distinct" | "pending",
) {
  const db = await admin();
  const { data, error } = await db
    .from("time_import_duplicates")
    .update({
      decision,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", PROVIDER)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Registro não encontrado.");
  return { ok: true };
}
