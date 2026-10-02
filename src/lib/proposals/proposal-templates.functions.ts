import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Modelos de proposta do workspace. Gravação limitada a administradores pela
// política de acesso do banco (is_workspace_admin).

export const listProposalTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [t, s] = await Promise.all([
      sb.from("proposal_templates").select("id, name, description, html, is_default").order("name"),
      sb.from("proposal_template_services").select("template_id, service_catalog_id"),
    ]);
    if (t.error) throw new Error(t.error.message);
    return (t.data ?? []).map((row) => ({
      ...row,
      services: (s.data ?? [])
        .filter((x) => x.template_id === row.id)
        .map((x) => x.service_catalog_id),
    }));
  });

export const saveProposalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        name: z.string().trim().min(1).max(200),
        description: z.string().max(500).nullable(),
        html: z.string().max(500_000),
        services: z.array(z.string().uuid()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const sb = context.supabase;
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const payload = {
      name: data.name,
      description: data.description,
      html: data.html,
      updated_at: new Date().toISOString(),
    };
    let id = data.id;
    if (id) {
      const { data: rows, error } = await sb
        .from("proposal_templates")
        .update(payload)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows?.length) throw new Error("Você não tem permissão para alterar modelos.");
    } else {
      const { data: row, error } = await sb
        .from("proposal_templates")
        .insert({ ...payload, workspace_id: workspaceId })
        .select("id")
        .single();
      if (error) throw new Error("Você não tem permissão para criar modelos.");
      id = row.id;
    }
    await sb.from("proposal_template_services").delete().eq("template_id", id);
    if (data.services.length) {
      const { error } = await sb.from("proposal_template_services").insert(
        data.services.map((sid) => ({
          template_id: id!,
          service_catalog_id: sid,
          workspace_id: workspaceId,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { id };
  });

export const deleteProposalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("proposal_templates")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Você não tem permissão para excluir este modelo.");
    return { ok: true };
  });
