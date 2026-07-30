import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveWorkspaceFor(userId: string): Promise<string> {
  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  return resolveActiveWorkspace(userId);
}

// ---------- Proposals ----------

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proposals")
      .select(
        "id,title,status,version,locked,total_amount,currency,deal_id,contact_id,company_id,expires_at,sent_at,created_at,updated_at,assigned_to",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProposal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Approvals (US-14.3) ----------

export const requestProposalApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspaceFor(userId);
    const { error: e1 } = await supabase
      .from("proposals")
      .update({ status: "in_review" })
      .eq("id", data.proposalId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("proposal_approvals").insert({
      workspace_id: workspaceId,
      proposal_id: data.proposalId,
      requested_by: userId,
      reviewer_id: data.reviewerId ?? null,
      comment: data.comment ?? null,
    });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const decideProposalApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const { data: appr, error: e0 } = await supabase
      .from("proposal_approvals")
      .select("proposal_id")
      .eq("id", data.approvalId)
      .single();
    if (e0) throw new Error(e0.message);
    const now = new Date().toISOString();
    const { error: e1 } = await supabase
      .from("proposal_approvals")
      .update({
        status: data.decision,
        comment: data.comment ?? null,
        decided_at: now,
        reviewer_id: userId,
      })
      .eq("id", data.approvalId);
    if (e1) throw new Error(e1.message);
    const newStatus = data.decision === "approved" ? "approved" : "draft";
    const { error: e2 } = await supabase
      .from("proposals")
      .update({ status: newStatus })
      .eq("id", appr.proposal_id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// ---------- Send + Seal (CA-14.1, CA-14.5) ----------

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { error } = await supabase
      .from("proposals")
      .update({
        status: "sent",
        sent_at: sentAt,
        locked: true,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Seal linked esign document (if any)
    if (prop.esign_document_id) {
      await supabase
        .from("esign_documents")
        .update({
          content_hash: contentHash,
          sealed_at: sentAt,
        })
        .eq("id", prop.esign_document_id);
      await supabase.from("esign_audit").insert({
        document_id: prop.esign_document_id,
        owner_id: prop.owner_id,
        event: "sealed",
        metadata: { hash: contentHash, proposal_id: prop.id },
      });
    }
    return { ok: true, contentHash };
  });

// ---------- Clauses (US-14.2) ----------

export const listClauses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
    const { error } = await context.supabase
      .from("proposal_clauses")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposal_clauses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- E-sign attachments (US-14.4) ----------

export const listEsignAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspaceFor(userId);
    // CA-14.4: max 10 attachments / 25 MB total
    const { data: existing } = await supabase
      .from("esign_attachments")
      .select("size_bytes")
      .eq("document_id", data.documentId);
    const count = existing?.length ?? 0;
    const totalBytes = (existing ?? []).reduce((s, r) => s + (r.size_bytes ?? 0), 0);
    if (count >= 10) throw new Error("Limite de 10 anexos por envelope.");
    if (totalBytes + (data.sizeBytes ?? 0) > 25 * 1024 * 1024) {
      throw new Error("Tamanho total dos anexos excederia 25 MB.");
    }
    const { error } = await supabase.from("esign_attachments").insert({
      workspace_id: workspaceId,
      document_id: data.documentId,
      owner_id: userId,
      file_name: data.fileName,
      file_url: data.fileUrl,
      mime_type: data.mimeType ?? null,
      size_bytes: data.sizeBytes ?? null,
      sha256: data.sha256 ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeEsignAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("esign_attachments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
