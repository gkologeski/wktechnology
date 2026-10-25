import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { workspaceOfSource } from "@/lib/workspace-source.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveWorkspaceFor(userId: string): Promise<string> {
  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  return resolveActiveWorkspace(userId);
}

// ---------- Proposals ----------

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.proposals", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proposals")
      .select(
        "id,title,status,version,locked,total_amount,currency,deal_id,contact_id,company_id,expires_at,sent_at,created_at,updated_at,assigned_to,companies(id,name)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProposal = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.proposals", "view")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: prop, error }, { data: approvals }] = await Promise.all([
      supabase.from("proposals").select("*").eq("id", data.id).single(),
      supabase
        .from("proposal_approvals")
        .select("*")
        .eq("proposal_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    return { proposal: prop, approvals: approvals ?? [] };
  });

export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "create")])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1).max(255),
        body: z.string().max(500_000).default(""),
        dealId: z.string().uuid().nullable().optional(),
        contactId: z.string().uuid().nullable().optional(),
        companyId: z.string().uuid().nullable().optional(),
        totalAmount: z.number().nullable().optional(),
        currency: z.string().min(3).max(3).default("BRL"),
        expiresAt: z.string().nullable().optional(),
        variables: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspaceFor(userId);
    const { data: prop, error } = await supabase
      .from("proposals")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        title: data.title,
        body: data.body,
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        company_id: data.companyId ?? null,
        total_amount: data.totalAmount ?? null,
        currency: data.currency,
        expires_at: data.expiresAt ?? null,
        variables: data.variables ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return prop;
  });

export const updateProposal = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(1).max(255).optional(),
          body: z.string().max(100_000).optional(),
          total_amount: z.number().nullable().optional(),
          currency: z.string().min(3).max(3).optional(),
          expires_at: z.string().nullable().optional(),
          deal_id: z.string().uuid().nullable().optional(),
          contact_id: z.string().uuid().nullable().optional(),
          company_id: z.string().uuid().nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposals", data.id, "update");

    const { data: cur, error: e0 } = await context.supabase
      .from("proposals")
      .select("status,locked")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (cur.locked) throw new Error("Proposta bloqueada para edição (já enviada).");
    const { error } = await context.supabase.from("proposals").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "delete")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposals", data.id, "delete");

    const { error } = await context.supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Approvals (US-14.3) ----------

export const requestProposalApproval = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) =>
    z
      .object({
        proposalId: z.string().uuid(),
        reviewerId: z.string().uuid().nullable().optional(),
        comment: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean; approvalId: string }>(
      context.supabase,
      "sales_proposal_request",
      {
        p_id: data.proposalId,
        p_reviewer: data.reviewerId ?? null,
        p_comment: data.comment ?? null,
      },
    );
  });

export const decideProposalApproval = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "approve")])
  .inputValidator((d) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        comment: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(context.supabase, "sales_proposal_decide", {
      p_approval: data.approvalId,
      p_decision: data.decision,
      p_comment: data.comment ?? null,
    });
  });

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_send", "manage")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prop, error: e0 } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (prop.status !== "approved" && prop.status !== "draft") {
      throw new Error(
        "Apenas propostas aprovadas (ou em rascunho sem fluxo de aprovação) podem ser enviadas.",
      );
    }
    const workspaceId = await workspaceOfSource(supabase, "proposals", prop.id);
    if (
      prop.esign_document_id &&
      (await workspaceOfSource(supabase, "esign_documents", prop.esign_document_id)) !== workspaceId
    )
      throw new Error("Proposta e documento pertencem a empresas diferentes.");
    const sentAt = new Date().toISOString();
    const hashInput = JSON.stringify({
      id: prop.id,
      title: prop.title,
      body: prop.body,
      total: prop.total_amount,
      currency: prop.currency,
      version: prop.version,
      sentAt,
    });
    const { createHash } = await import("crypto");
    const contentHash = createHash("sha256").update(hashInput).digest("hex");
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean; contentHash: string }>(supabase, "proposal_publish_with_esign", {
      p_id: data.id,
      p_hash: contentHash,
      p_sent_at: sentAt,
    });
  });

// ---------- Clauses (US-14.2) ----------

export const listClauses = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.proposal_clauses", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proposal_clauses")
      .select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createClause = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_clauses", "create")])
  .inputValidator((d) =>
    z
      .object({
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_-]+$/i),
        title: z.string().min(1).max(255),
        category: z.string().max(100).optional(),
        body: z.string().max(50_000).default(""),
        is_default: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspaceFor(userId);
    const { data: row, error } = await supabase
      .from("proposal_clauses")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        slug: data.slug,
        title: data.title,
        category: data.category ?? null,
        body: data.body,
        is_default: data.is_default,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateClause = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_clauses", "update")])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(1).max(255).optional(),
          category: z.string().max(100).nullable().optional(),
          body: z.string().max(50_000).optional(),
          is_default: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposal_clauses", data.id, "update");

    const { error } = await context.supabase
      .from("proposal_clauses")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClause = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposal_clauses", "delete")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposal_clauses", data.id, "delete");

    const { error } = await context.supabase.from("proposal_clauses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- E-sign attachments (US-14.4) ----------

export const listEsignAttachments = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.proposals", "view")])
  .inputValidator((d: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("esign_attachments")
      .select("*")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addEsignAttachment = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) =>
    z
      .object({
        documentId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        fileUrl: z.string().url().max(2000),
        mimeType: z.string().max(100).optional(),
        sizeBytes: z
          .number()
          .int()
          .nonnegative()
          .max(25 * 1024 * 1024)
          .optional(),
        sha256: z.string().length(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(context.supabase, "contract_esign_attachment", {
      p_action: "add",
      p_document: data.documentId,
      p_id: null,
      p_data: data,
    });
  });

export const removeEsignAttachment = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "delete")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(context.supabase, "contract_esign_attachment", {
      p_action: "remove",
      p_document: null,
      p_id: data.id,
      p_data: {},
    });
  });

// ---------- Public verify (CA-14.5) ----------

export const verifyEsignHash = createServerFn({ method: "GET" })
  .inputValidator((d: { hash: string }) =>
    z
      .object({
        hash: z
          .string()
          .min(16)
          .max(128)
          .regex(/^[a-f0-9]+$/i),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("esign_verify_hash", {
      _hash: data.hash,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { found: false as const };
    return { found: true as const, ...row };
  });
