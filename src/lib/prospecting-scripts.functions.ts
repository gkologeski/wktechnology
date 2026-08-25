import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

// Carrega o cliente admin sob demanda (mantém o bundle do cliente limpo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ProspectingScript = {
  id: string;
  name: string;
  system_prompt: string;
  first_message: string;
  objective: string | null;
  voice_id: string | null;
  voice_provider: "elevenlabs" | "vapi_default";
  variables: Record<string, string>;
  created_at: string;
  updated_at: string;
};

const ScriptInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  system_prompt: z.string().max(8000).default(""),
  first_message: z.string().max(1000).default(""),
  objective: z.string().max(200).nullable().optional(),
  voice_id: z.string().max(64).nullable().optional(),
  voice_provider: z.enum(["elevenlabs", "vapi_default"]).default("elevenlabs"),
  variables: z.record(z.string(), z.string()).default({}),
});

export const listScripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProspectingScript[]> => {
    const sb = await sbAdmin();
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await sb
      .from("prospecting_scripts")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProspectingScript[];
  });

export const upsertScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ScriptInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = await sbAdmin();
    const ws = await resolveActiveWorkspace(context.userId);
    const payload = {
      workspace_id: ws,
      owner_id: ws,
      name: data.name,
      system_prompt: data.system_prompt,
      first_message: data.first_message,
      objective: data.objective ?? null,
      voice_id: data.voice_id ?? null,
      voice_provider: data.voice_provider,
      variables: data.variables,
    };
    if (data.id) {
      const { error } = await sb
        .from("prospecting_scripts")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("prospecting_scripts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = await sbAdmin();
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await sb
      .from("prospecting_scripts")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
