// Validador de API key para rotas /api/public/v1/*
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ApiAuthContext = {
  ownerId: string;
  workspaceId: string;
  scopes: string[];
  keyId: string;
};

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function authenticateApiKey(request: Request): Promise<ApiAuthContext | null> {
  const header = request.headers.get("authorization") || request.headers.get("x-api-key");
  if (!header) return null;
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (!raw.startsWith("lvb_")) return null;
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, owner_id, workspace_id, scopes, revoked_at, expires_at")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return {
    ownerId: data.owner_id as string,
    workspaceId: data.workspace_id as string,
    scopes: (data.scopes as string[]) ?? [],
    keyId: data.id as string,
  };
}


export function requireScope(ctx: ApiAuthContext, scope: "read" | "write"): Response | null {
  if (scope === "read" && (ctx.scopes.includes("read") || ctx.scopes.includes("write")))
    return null;
  if (scope === "write" && ctx.scopes.includes("write")) return null;
  return new Response(JSON.stringify({ error: "insufficient_scope" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
  });
}
