// Server fns para layouts de registro (sidebar configurável) por entidade.
// Estrutura: sections = [{ title, keys: string[] }] — keys referem-se às
// chaves de propriedades padrão exibidas no PropertiesPanel.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LayoutSection = { title: string; keys: string[] };
export type RecordEntity = "leads" | "contacts" | "companies" | "deals";

async function getActiveWorkspaceId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
  if (activeId) return activeId;
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const id = (m as { workspace_id?: string } | null)?.workspace_id;
  if (!id) throw new Error("Nenhum workspace ativo.");
  return id;
}

async function assertAdmin(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data as { role: string }).role !== "admin") {
    throw new Error("Apenas admins do workspace podem editar o layout do registro.");
  }
}

const entitySchema = z.enum(["leads", "contacts", "companies", "deals"]);
const sectionsSchema = z
  .array(
    z.object({
      title: z.string().min(1).max(80),
      keys: z.array(z.string().min(1).max(120)).max(100),
    }),
  )
  .max(20);

export const getRecordLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ entity: entitySchema }).parse(i))
  .handler(async ({ data, context }) => {
    const workspaceId = await getActiveWorkspaceId(context.userId);
    const { data: row, error } = await context.supabase
      .from("record_layouts")
      .select("id, sections, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { sections: null as LayoutSection[] | null };
    return { sections: ((row as { sections: unknown }).sections ?? []) as LayoutSection[] };
  });

export const upsertRecordLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: entitySchema,
        sections: sectionsSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await getActiveWorkspaceId(context.userId);
    await assertAdmin(workspaceId, context.userId);

    const { data: existing } = await context.supabase
      .from("record_layouts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("record_layouts")
        .update({ sections: data.sections as never })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("record_layouts")
        .insert({ entity: data.entity, sections: data.sections as never } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
