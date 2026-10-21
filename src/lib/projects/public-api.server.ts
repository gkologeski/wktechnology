// API pública v1 do TechProjects (servidor). Toda leitura/escrita passa pelas portas
// `project_api_*` do banco, que executam como o DONO da chave (RLS, negações, membership ativo,
// workspace da chave) — o cliente administrativo aqui só autentica a chave e chama as portas.
// Logs estruturados com id de correlação; nunca registram a chave nem o corpo.
import type { ApiAuthContext } from "@/lib/api-keys/auth.server";
import { PUBLIC_API_RATE_LIMIT, PUBLIC_API_RATE_WINDOW_SECONDS } from "@/lib/limits";
import {
  canonicalJson,
  mapApiDbError,
  PublicTimeEntryInput,
  resolveIdempotencyKey,
  sha256Hex,
  toEntryPayload,
} from "./public-api.shared";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApiCtx = {
  cid: string;
  started: number;
  route: string;
  method: string;
  headers: Record<string, string>;
};

export function newCtx(request: Request, route: string): ApiCtx {
  const incoming = request.headers.get("x-request-id");
  const cid = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  return {
    cid,
    started: Date.now(),
    route,
    method: request.method,
    headers: { "X-Request-Id": cid },
  };
}

export function respond(ctx: ApiCtx, body: unknown, status: number, keyId?: string): Response {
  console.log(
    JSON.stringify({
      evt: "api.v1",
      cid: ctx.cid,
      route: ctx.route,
      method: ctx.method,
      status,
      ms: Date.now() - ctx.started,
      key_id: keyId ?? null,
    }),
  );
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...ctx.headers },
  });
}

/** Autentica a chave, aplica o escopo e o limite por chave. Devolve o contexto ou a recusa. */
export async function guard(
  request: Request,
  ctx: ApiCtx,
  scope: "read" | "write",
): Promise<{ auth: ApiAuthContext; admin: Admin } | Response> {
  const { authenticateApiKey } = await import("@/lib/api-keys/auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const auth = await authenticateApiKey(request);
  if (!auth) {
    ctx.headers["WWW-Authenticate"] = "Bearer";
    return respond(ctx, { error: "unauthorized" }, 401);
  }
  const okScope =
    scope === "read"
      ? auth.scopes.includes("read") || auth.scopes.includes("write")
      : auth.scopes.includes("write");
  if (!okScope) return respond(ctx, { error: "insufficient_scope" }, 403, auth.keyId);
  const { data, error } = await callPort(supabaseAdmin, "api_rate_hit", {
    p_key: auth.keyId,
    p_limit: PUBLIC_API_RATE_LIMIT,
    p_window_seconds: PUBLIC_API_RATE_WINDOW_SECONDS,
  });
  if (error) return respond(ctx, { error: "rate_limit_unavailable" }, 503, auth.keyId);
  const r = data as { allowed: boolean; limit: number; remaining: number; reset_at: string };
  const reset = new Date(r.reset_at).getTime();
  ctx.headers["X-RateLimit-Limit"] = String(r.limit);
  ctx.headers["X-RateLimit-Remaining"] = String(r.remaining);
  ctx.headers["X-RateLimit-Reset"] = String(Math.floor(reset / 1000));
  if (!r.allowed) {
    ctx.headers["Retry-After"] = String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)));
    return respond(ctx, { error: "rate_limited" }, 429, auth.keyId);
  }
  return { auth, admin: supabaseAdmin };
}

function listParams(url: URL) {
  const n = (k: string, d: number) => {
    const raw = url.searchParams.get(k);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.trunc(v) : d;
  };
  const limit = Math.min(Math.max(n("limit", 50), 1), 200);
  const offset =
    url.searchParams.get("offset") !== null
      ? Math.max(n("offset", 0), 0)
      : url.searchParams.get("page")
        ? (Math.max(n("page", 1), 1) - 1) * limit
        : 0;
  return { limit, offset };
}

/** UUID opcional da query: `undefined` quando inválido. */
function optUuid(url: URL, key: string): string | null | undefined {
  const v = url.searchParams.get(key);
  if (v == null || v === "") return null;
  return UUID.test(v) ? v : undefined;
}

function meta(total: number, limit: number, offset: number, rows: number) {
  return { limit, offset, total, has_more: offset + rows < total };
}

async function callPort(admin: Admin, fn: string, args: Record<string, unknown>) {
  const rpc = admin.rpc.bind(admin) as unknown as RpcFn;
  return rpc(fn, args);
}

type Page = { data: unknown[]; total: number; limit: number; offset: number };

async function listVia(
  ctx: ApiCtx,
  g: { auth: ApiAuthContext; admin: Admin },
  fn: string,
  args: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await callPort(g.admin, fn, {
    p_key: g.auth.keyId,
    p_user: g.auth.ownerId,
    p_ws: g.auth.workspaceId,
    ...args,
  });
  if (error) {
    const m = mapApiDbError(error.message);
    return respond(ctx, { error: m.error, message: m.message }, m.status, g.auth.keyId);
  }
  const r = data as Page;
  return respond(
    ctx,
    { data: r.data, meta: meta(r.total, r.limit, r.offset, r.data.length) },
    200,
    g.auth.keyId,
  );
}

export async function handleListProjects(request: Request): Promise<Response> {
  const ctx = newCtx(request, "/v1/projects");
  const g = await guard(request, ctx, "read");
  if (g instanceof Response) return g;
  const url = new URL(request.url);
  const { limit, offset } = listParams(url);
  return listVia(ctx, g, "project_api_list_projects", {
    p_status: url.searchParams.get("status") || null,
    p_search: url.searchParams.get("q")?.slice(0, 120) || null,
    p_limit: limit,
    p_offset: offset,
  });
}

export async function handleListTasks(request: Request): Promise<Response> {
  const ctx = newCtx(request, "/v1/project-tasks");
  const g = await guard(request, ctx, "read");
  if (g instanceof Response) return g;
  const url = new URL(request.url);
  const project = optUuid(url, "project_id");
  if (project === undefined)
    return respond(ctx, { error: "invalid_input", message: "project_id inválido." }, 400, g.auth.keyId);
  const { limit, offset } = listParams(url);
  return listVia(ctx, g, "project_api_list_tasks", {
    p_project: project,
    p_status: url.searchParams.get("status") || null,
    p_search: url.searchParams.get("q")?.slice(0, 120) || null,
    p_limit: limit,
    p_offset: offset,
  });
}

export async function handleListEntries(request: Request): Promise<Response> {
  const ctx = newCtx(request, "/v1/time-entries");
  const g = await guard(request, ctx, "read");
  if (g instanceof Response) return g;
  const url = new URL(request.url);
  const project = optUuid(url, "project_id");
  const subject = optUuid(url, "user_id");
  if (project === undefined || subject === undefined)
    return respond(ctx, { error: "invalid_input", message: "Identificador inválido." }, 400, g.auth.keyId);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !DATE_ONLY.test(from)) || (to && !DATE_ONLY.test(to)))
    return respond(ctx, { error: "invalid_input", message: "Datas no formato AAAA-MM-DD." }, 400, g.auth.keyId);
  const { limit, offset } = listParams(url);
  return listVia(ctx, g, "project_api_list_time_entries", {
    p_project: project,
    p_subject: subject,
    p_status: url.searchParams.get("status") || null,
    p_from: from || null,
    p_to: to || null,
    p_ascending: (url.searchParams.get("order") ?? "desc").toLowerCase() === "asc",
    p_limit: limit,
    p_offset: offset,
  });
}

export async function handleCreateEntry(request: Request): Promise<Response> {
  const ctx = newCtx(request, "/v1/time-entries");
  const g = await guard(request, ctx, "write");
  if (g instanceof Response) return g;
  const raw = await request.json().catch(() => null);
  const parsed = PublicTimeEntryInput.safeParse(raw);
  if (!parsed.success)
    return respond(ctx, { error: "invalid_input", details: parsed.error.flatten() }, 400, g.auth.keyId);
  const body = parsed.data;
  if (!!body.start_time !== !!body.end_time)
    return respond(ctx, { error: "invalid_input", message: "Informe start_time e end_time juntos." }, 400, g.auth.keyId);
  const payload = toEntryPayload(body);
  const idem = resolveIdempotencyKey(request.headers.get("idempotency-key"), body.external_id);
  if (!idem || idem.length < 8 || idem.length > 200)
    return respond(
      ctx,
      {
        error: "idempotency_key_required",
        message: "Envie o cabeçalho Idempotency-Key (8 a 200 caracteres) ou external_id.",
      },
      400,
      g.auth.keyId,
    );
  const hash = await sha256Hex(canonicalJson(payload));
  const { data, error } = await callPort(g.admin, "project_api_create_time_entry", {
    p_key: g.auth.keyId,
    p_user: g.auth.ownerId,
    p_ws: g.auth.workspaceId,
    p_idem: idem,
    p_hash: hash,
    p_payload: payload,
  });
  if (error) {
    const m = mapApiDbError(error.message);
    return respond(ctx, { error: m.error, message: m.message }, m.status, g.auth.keyId);
  }
  const r = data as { data: Record<string, unknown>; replay: boolean };
  if (r.replay) ctx.headers["Idempotent-Replayed"] = "true";
  else {
    const { enqueueProjectEvent } = await import("@/lib/webhooks/dispatcher.server");
    await enqueueProjectEvent(
      g.auth.workspaceId,
      "project.time_entry.created",
      projectEventPayload(r.data),
    );
  }
  return respond(ctx, { data: r.data, idempotent: r.replay }, r.replay ? 200 : 201, g.auth.keyId);
}

/** Carga mínima de evento: sem descrição, custo ou dados pessoais além dos ids. */
export function projectEventPayload(e: Record<string, unknown>) {
  return {
    entry_id: e.id,
    project_id: e.project_id,
    task_id: e.task_id,
    user_id: e.user_id,
    entry_date: e.entry_date,
    duration_seconds: e.duration_seconds,
    status: e.status,
    source: e.source,
  };
}
