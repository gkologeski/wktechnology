import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

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
  archived_at: string | null;
};

const ScriptInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  system_prompt: z.string().max(8000).default(""),
  first_message: z.string().max(1000).default(""),
  objective: z.string().max(200).nullable().optional(),
  voice_id: z.string().max(64).nullable().optional(),
  voice_provider: z.enum(["elevenlabs", "vapi_default"]).default("elevenlabs"),
  // Older rows may store an empty list; treat any array as "no variables".
  variables: z.preprocess(
    (v) => (Array.isArray(v) ? {} : v),
    z.record(z.string(), z.string()),
  ).default({}),
});

export const listScripts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scripts", "view")])
  .inputValidator((i) =>
    z.object({ includeArchived: z.boolean().optional() }).optional().parse(i),
  )
  .handler(async ({ data: input, context }): Promise<ProspectingScript[]> => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    let q = sb.from("prospecting_scripts").select("*").eq("workspace_id", ws);
    if (!input?.includeArchived) q = q.is("archived_at", null);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProspectingScript[];
  });

export const upsertScript = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scripts", ["create", "update"])])
  .inputValidator((i) => ScriptInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const payload = {
      workspace_id: ws,
      owner_id: context.userId,
      name: data.name,
      system_prompt: data.system_prompt,
      first_message: data.first_message,
      objective: data.objective ?? null,
      voice_id: data.voice_id ?? null,
      voice_provider: data.voice_provider,
      variables: data.variables,
    };
    if (data.id) {
      const { owner_id: _owner, workspace_id: _ws, ...updatable } = payload;
      const { error } = await sb
        .from("prospecting_scripts")
        .update(updatable)
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
  .middleware([requireSalesPermission("techsales.prospecting_scripts", "delete")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.id)
      await assertSalesRecord(context.supabase, "prospecting_scripts", data.id, "delete");

    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const { count } = await sb
      .from("prospecting_campaign_variants")
      .select("id", { count: "exact", head: true })
      .eq("script_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error(
        "Este roteiro já foi usado em campanhas e não pode ser excluído. Arquive-o para tirá-lo da lista.",
      );
    const { error } = await sb
      .from("prospecting_scripts")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setScriptArchived = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scripts", "update")])
  .inputValidator((i) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "prospecting_scripts", data.id, "update");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: rows, error } = await context.supabase
      .from("prospecting_scripts")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Sem permissão para alterar este roteiro.");
    return { ok: true };
  });

export const listScriptUsage = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scripts", "view")])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("prospecting_campaign_variants")
      .select("script_id");
    if (error) throw new Error(error.message);
    return Array.from(new Set((data ?? []).map((r) => r.script_id as string)));
  });
