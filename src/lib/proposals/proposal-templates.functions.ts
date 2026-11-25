import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Modelos de proposta do workspace. Gravação limitada a administradores pela
// política de acesso do banco (is_workspace_admin).

export const listProposalTemplates = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "view")])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [t, s] = await Promise.all([
      sb
        .from("proposal_templates")
        .select(
          "id, name, description, html, is_default, contract_template_id, layout_kind, design_json",
        )
        .order("name"),
      sb.from("proposal_template_services").select("template_id, service_catalog_id"),
    ]);
    if (t.error) throw new Error(t.error.message);
    return (t.data ?? []).map((row) => ({
      ...row,
      layout_kind: row.layout_kind === "visual" ? ("visual" as const) : ("rich_text" as const),
      design_json: row.design_json ?? null,
      services: (s.data ?? [])
        .filter((x) => x.template_id === row.id)
        .map((x) => x.service_catalog_id),
    }));
  });

export const saveProposalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        name: z.string().trim().min(1).max(200),
        description: z.string().max(500).nullable(),
        html: z.string().max(500_000),
        services: z.array(z.string().uuid()).max(200),
        contract_template_id: z.string().uuid().nullable().default(null),
        layout_kind: z.enum(["rich_text", "visual"]).default("rich_text"),
        design_json: z.unknown().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { parseVisualDesign } = await import("./visual-design");
    const sb = context.supabase;
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(sb, "techsales.proposal_templates", data.id ? "update" : "create");
    const layoutKind = data.layout_kind ?? "rich_text";
    const validatedDesign =
      layoutKind === "visual"
        ? parseVisualDesign(data.design_json)
        : data.design_json != null
          ? parseVisualDesign(data.design_json)
          : null;
    if (data.contract_template_id) {
      const { data: model, error } = await sb
        .from("contract_templates")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", data.contract_template_id)
        .eq("status", "published")
        .maybeSingle();
      if (error || !model)
        throw new Error("Modelo de contrato publicado indisponível neste workspace.");
    }
    const payload = {
      name: data.name,
      description: data.description,
      html: data.html,
      contract_template_id: data.contract_template_id,
      layout_kind: layoutKind,
      design_json: validatedDesign as never,
      updated_at: new Date().toISOString(),
    };
    let id = data.id;
    if (id) {
      const { data: rows, error } = await sb
        .from("proposal_templates")
        .update(payload)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
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
    const { error: deleteServicesError } = await sb
      .from("proposal_template_services")
      .delete()
      .eq("template_id", id)
      .select("template_id");
    if (deleteServicesError) throw new Error(deleteServicesError.message);
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
  .middleware([requireSalesPermission("techsales.proposal_templates", "delete")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposal_templates", data.id, "delete");

    const { data: rows, error } = await context.supabase
      .from("proposal_templates")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Você não tem permissão para excluir este modelo.");
    return { ok: true };
  });

export const duplicateProposalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "create")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { nextCopyName } = await import("@/lib/proposals/copy-name");
    const sb = context.supabase;
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(sb, "techsales.proposal_templates", "create");
    await assertSalesRecord(sb, "proposal_templates", data.id, "view");

    const { data: source, error: sourceError } = await sb
      .from("proposal_templates")
      .select("id, name, description, html, contract_template_id, layout_kind, design_json")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source) throw new Error("Modelo de proposta não encontrado neste workspace.");

    if (source.contract_template_id) {
      const { data: model, error: modelError } = await sb
        .from("contract_templates")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", source.contract_template_id)
        .eq("status", "published")
        .maybeSingle();
      if (modelError || !model) {
        throw new Error("Modelo de contrato publicado indisponível neste workspace.");
      }
    }

    const [servicesRes, namesRes] = await Promise.all([
      sb
        .from("proposal_template_services")
        .select("service_catalog_id")
        .eq("template_id", source.id)
        .eq("workspace_id", workspaceId),
      sb.from("proposal_templates").select("name").eq("workspace_id", workspaceId),
    ]);
    if (servicesRes.error) throw new Error(servicesRes.error.message);
    if (namesRes.error) throw new Error(namesRes.error.message);

    const copyName = nextCopyName(
      source.name,
      (namesRes.data ?? []).map((row) => row.name),
    );
    const services = (servicesRes.data ?? []).map((row) => row.service_catalog_id);

    const { data: created, error: insertError } = await sb
      .from("proposal_templates")
      .insert({
        workspace_id: workspaceId,
        name: copyName,
        description: source.description,
        html: source.html,
        is_default: false,
        contract_template_id: source.contract_template_id,
        layout_kind: source.layout_kind ?? "rich_text",
        design_json: source.design_json ?? null,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, name, description, html, is_default, contract_template_id, layout_kind, design_json",
      )
      .single();
    if (insertError) {
      if (insertError.code === "42501") {
        throw new Error("Você não tem permissão para criar modelos.");
      }
      throw new Error(insertError.message || "Não foi possível duplicar o modelo.");
    }

    if (services.length) {
      const { error: svcInsertError } = await sb.from("proposal_template_services").insert(
        services.map((sid) => ({
          template_id: created.id,
          service_catalog_id: sid,
          workspace_id: workspaceId,
        })),
      );
      if (svcInsertError) throw new Error(svcInsertError.message);
    }

    return {
      ...created,
      layout_kind: created.layout_kind === "visual" ? ("visual" as const) : ("rich_text" as const),
      design_json: created.design_json ?? null,
      services,
    };
  });
