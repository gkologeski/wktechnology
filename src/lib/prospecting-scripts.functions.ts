import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin
      .from("prospecting_scripts" as never)
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ProspectingScript[];
  });

export const upsertScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ScriptInput.parse(i))
  .handler(async ({ data, context }) => {
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
      const { error } = await supabaseAdmin
        .from("prospecting_scripts" as never)
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("prospecting_scripts" as never)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("prospecting_scripts" as never)
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
