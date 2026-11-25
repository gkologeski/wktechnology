import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const saveProposalVisualDesign = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) =>
    z
      .object({
        proposalId: z.string().uuid(),
        designJson: z.unknown().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { parseVisualDesign } = await import("./visual-design");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(context.supabase, "techsales.proposals", "update");
    await assertSalesRecord(context.supabase, "proposals", data.proposalId, "update");
    const { data: cur, error: readErr } = await context.supabase
      .from("proposals")
      .select("locked")
      .eq("id", data.proposalId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!cur) throw new Error("Proposta não encontrada neste workspace.");
    if (cur.locked) throw new Error("Proposta bloqueada para edição (já enviada).");
    const validated = data.designJson === null ? null : parseVisualDesign(data.designJson);
    const { error } = await context.supabase
      .from("proposals")
      .update({ design_json: validated as never })
      .eq("id", data.proposalId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createProposalAssetUpload = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        filename: z.string().trim().min(1).max(200),
        mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]),
        size_bytes: z
          .number()
          .int()
          .min(1)
          .max(5 * 1024 * 1024),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PROPOSAL_ASSETS_BUCKET, slugifyProposalAssetName } =
      await import("./proposal-assets.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    try {
      await assertSalesArea(context.supabase, "techsales.proposal_templates", "update");
    } catch {
      await assertSalesArea(context.supabase, "techsales.proposal_templates", "create");
    }
    const safeName = slugifyProposalAssetName(data.filename);
    const path = `${workspaceId}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PROPOSAL_ASSETS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao preparar upload da imagem.");
    return {
      bucket: PROPOSAL_ASSETS_BUCKET,
      path,
      token: signed.token,
      filename: safeName,
    };
  });

export const signProposalAssetUrls = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "view")])
  .inputValidator((d) => z.object({ paths: z.array(z.string().min(1).max(500)).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { signProposalAssetPaths } = await import("./proposal-assets.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(context.supabase, "techsales.proposal_templates", "view");
    return signProposalAssetPaths(data.paths, workspaceId);
  });

export const listBrandKitContext = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "view")])
  .handler(async ({ context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(context.supabase, "techsales.proposal_templates", "view");
    const [entitiesRes, brandingRes] = await Promise.all([
      context.supabase
        .from("legal_entities")
        .select("id, name, trade_name, cnpj, logo_url, is_default")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("is_default", { ascending: false })
        .order("name"),
      context.supabase
        .from("workspace_branding")
        .select("logo_url, primary_color")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);
    const legalEntities = entitiesRes.error
      ? []
      : (entitiesRes.data ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          trade_name: e.trade_name,
          cnpj: e.cnpj,
          logo_url: e.logo_url,
          is_default: e.is_default,
        }));
    const branding = brandingRes.error ? null : brandingRes.data;
    return {
      legalEntities,
      workspaceLogoUrl: branding?.logo_url ?? null,
      workspacePrimaryColor: branding?.primary_color ?? null,
    };
  });

export const listProposalsForPreview = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "view")])
  .handler(async ({ context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(context.supabase, "techsales.proposal_templates", "view");
    const { data, error } = await context.supabase
      .from("proposals")
      .select("id, title, status, total_amount, currency, companies(name)")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(15);
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      total_amount: row.total_amount != null ? Number(row.total_amount) : null,
      currency: row.currency ?? "BRL",
      company_name: (row.companies as { name?: string } | null)?.name ?? null,
    }));
  });

export const loadProposalPreviewContext = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_templates", "view")])
  .inputValidator((d) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { loadProposalDocument } = await import("./proposal-document.server");
    const { buildProposalVisualContext } = await import("./proposal-assets.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertSalesArea(context.supabase, "techsales.proposal_templates", "view");
    await assertSalesRecord(context.supabase, "proposals", data.proposalId, "view");
    const doc = await loadProposalDocument(context.supabase, { id: data.proposalId });
    const { data: extra } = await context.supabase
      .from("proposals")
      .select(
        "legal_entity_id, payment_method, installments_count, validity_days, payment_terms, company_id, deal_id",
      )
      .eq("id", data.proposalId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const [companyRes, dealRes] = await Promise.all([
      extra?.company_id
        ? context.supabase
            .from("companies")
            .select("cnpj, custom_fields")
            .eq("id", extra.company_id)
            .eq("workspace_id", workspaceId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      extra?.deal_id
        ? context.supabase
            .from("deals")
            .select("name")
            .eq("id", extra.deal_id)
            .eq("workspace_id", workspaceId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const companyExtra = companyRes.data as {
      cnpj: string | null;
      custom_fields: Record<string, unknown> | null;
    } | null;
    return buildProposalVisualContext(context.supabase, {
      workspaceId,
      title: doc.proposal.title,
      currency: doc.proposal.currency,
      totalAmount: doc.proposal.total_amount,
      createdAt: doc.proposal.created_at,
      expiresAt: doc.proposal.expires_at,
      validityDays: extra?.validity_days ?? null,
      paymentMethod: extra?.payment_method ?? null,
      installmentsCount: extra?.installments_count ?? null,
      paymentTerms: extra?.payment_terms ?? null,
      companyName: doc.company,
      companyLegalName:
        (companyExtra?.custom_fields?.["razao_social"] as string | undefined) ?? doc.company,
      companyCnpj: companyExtra?.cnpj ?? null,
      contactName: doc.contact,
      contactEmail: doc.contactEmail,
      dealName: (dealRes.data as { name?: string } | null)?.name ?? doc.proposal.title,
      agentName: doc.agent,
      legalEntityId: extra?.legal_entity_id ?? null,
      items: doc.items,
    });
  });
