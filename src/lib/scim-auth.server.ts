// Server-only: autenticação de requisições SCIM via Bearer token.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function authenticateScimRequest(
  request: Request,
): Promise<{ workspaceId: string } | null> {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(scim_[a-f0-9]+)/i);
  if (!m) return null;
  const hash = await sha256Hex(m[1]);
  const { data } = await supabaseAdmin
    .from("scim_tokens")
    .select("id, workspace_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await (supabaseAdmin.from("scim_tokens") as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { workspaceId: data.workspace_id as string };
}

export function scimError(status: number, detail: string) {
  return new Response(
    JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    }),
    { status, headers: { "Content-Type": "application/scim+json" } },
  );
}

export function scimJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/scim+json" },
  });
}
