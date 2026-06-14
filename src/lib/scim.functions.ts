// SCIM tokens (provisionamento Okta/Azure).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function activeWorkspace(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("Workspace ativo não encontrado");
  return data.active_workspace_id as string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `scim_${hex}`;
}

export const listScimTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { data } = await supabase
      .from("scim_tokens")
      .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const createScimToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const token = genToken();
    const hash = await sha256Hex(token);
    const prefix = token.slice(0, 12);
    const { error } = await (supabase.from("scim_tokens") as any).insert({
      owner_id: ws,
      workspace_id: ws,
      name: data.name,
      token_hash: hash,
      token_prefix: prefix,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    // Retornar token uma única vez.
    return { token, prefix };
  });

export const revokeScimToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { error } = await (supabase.from("scim_tokens") as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
