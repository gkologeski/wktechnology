// Server functions para API keys públicas
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCOPES = ["read", "write"] as const;
export const API_SCOPES = SCOPES;

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    return { keys: data ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; scopes?: string[]; expires_at?: string | null }) =>
    z
      .object({
        name: z.string().min(1).max(120),
        scopes: z.array(z.enum(SCOPES)).min(1).default(["read"]),
        expires_at: z.string().datetime().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const raw = `lvb_${randomBytes(24).toString("hex")}`;
    const prefix = raw.slice(0, 10);
    const key_hash = hashKey(raw);
    const { data: row, error } = await supabase
      .from("api_keys")
      .insert({
        owner_id: userId,
        name: data.name,
        prefix,
        key_hash,
        scopes: data.scopes,
        expires_at: data.expires_at ?? null,
      })
      .select("id, name, prefix, scopes, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: row, secret: raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", userId);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("api_keys").delete().eq("id", data.id).eq("owner_id", userId);
    return { ok: true };
  });
