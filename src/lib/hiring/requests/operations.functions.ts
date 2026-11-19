import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { z } from "zod";
import { requestKind } from "./types";
import {
  FISCAL_MAX_BYTES,
  opsDay as day,
  opsId as id,
  sniffFiscalMime,
  type OpsContext,
} from "./operations-types";

export const getOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<OpsContext>(context.supabase, "hiring_execution_ops_context", { w, i: data.id });
  });

/** Projects/milestones visible to the caller (user RLS, limited); the RPC rechecks visibility. */
export const listDeliveryProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      projectId: id.nullable(),
      milestoneId: id.nullable().optional(),
      projectSearch: z.string().max(100).default(""),
      milestoneSearch: z.string().max(100).default(""),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    // Only callers allowed to manage deliveries of this request may list references.
    const ops = await workRpc<OpsContext>(context.supabase, "hiring_execution_ops_context", {
      w,
      i: data.id,
    });
    if (!ops.can_manage_deliveries) throw new Error("Sem permissão para esta ação.");
    const projects = await context.supabase
      .from("projects")
      .select("id,name")
      .eq("workspace_id", w)
      .ilike("name", `%${data.projectSearch.trim()}%`)
      .order("name")
      .limit(50);
    if (projects.error) throw new Error("Projetos indisponíveis.");
    let milestones: Array<{ id: string; name: string }> = [];
    if (data.projectId) {
      const m = await context.supabase
        .from("project_milestones")
        .select("id,name")
        .eq("workspace_id", w)
        .eq("project_id", data.projectId)
        .ilike("name", `%${data.milestoneSearch.trim()}%`)
        .order("sort_order")
        .limit(50);
      if (m.error) throw new Error("Marcos indisponíveis.");
      milestones = m.data ?? [];
    }
    const visibleProjects = projects.data ?? [];
    if (data.projectId && !visibleProjects.some((p) => p.id === data.projectId)) {
      const selected = await context.supabase
        .from("projects")
        .select("id,name")
        .eq("workspace_id", w)
        .eq("id", data.projectId)
        .maybeSingle();
      if (selected.error) throw new Error("Projeto selecionado indisponível.");
      if (selected.data) visibleProjects.push(selected.data);
    }
    if (data.projectId && data.milestoneId && !milestones.some((m) => m.id === data.milestoneId)) {
      const selected = await context.supabase
        .from("project_milestones")
        .select("id,name")
        .eq("workspace_id", w)
        .eq("project_id", data.projectId)
        .eq("id", data.milestoneId)
        .maybeSingle();
      if (selected.error) throw new Error("Marco selecionado indisponível.");
      if (selected.data) milestones.push(selected.data);
    }
    return { projects: visibleProjects, milestones };
  });

export const saveDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      deliveryId: id.nullable(),
      version: z.number().int().positive().nullable(),
      title: z.string().trim().min(3).max(200),
      criteria: z.string().trim().min(10).max(5000),
      periodStart: day,
      periodEnd: day,
      responsibleId: id,
      projectId: id.nullable(),
      milestoneId: id.nullable(),
      reason: z.string().trim().max(2000).nullable(),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return {
      id: await workRpc<string>(context.supabase, "hiring_delivery_save", {
        w,
        i: data.id,
        p_delivery: data.deliveryId,
        p_version: data.version,
        p_title: data.title,
        p_criteria: data.criteria,
        p_start: data.periodStart,
        p_end: data.periodEnd,
        p_responsible: data.responsibleId,
        p_project: data.projectId,
        p_milestone: data.milestoneId,
        p_reason: data.reason,
        p_operation: data.operation,
      }),
    };
  });

export const submitDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      deliveryId: id,
      version: z.number().int().positive(),
      evidence: z.string().trim().min(10).max(5000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return {
      id: await workRpc<string>(context.supabase, "hiring_delivery_submit", {
        w,
        i: data.id,
        p_delivery: data.deliveryId,
        p_version: data.version,
        p_evidence: data.evidence,
        p_operation: data.operation,
      }),
    };
  });

export const decideDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      deliveryId: id,
      version: z.number().int().positive(),
      contentHash: z.string().regex(/^[0-9a-f]{64}$/),
      decision: z.enum(["accepted", "rejected"]),
      reason: z.string().trim().min(5).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return {
      id: await workRpc<string>(context.supabase, "hiring_delivery_decide", {
        w,
        i: data.id,
        p_delivery: data.deliveryId,
        p_version: data.version,
        p_hash: data.contentHash,
        p_decision: data.decision,
        p_reason: data.reason,
        p_operation: data.operation,
      }),
    };
  });

/** Upload: real bytes are type-sniffed and SHA-256 hashed here, stored with the caller's session, re-read and only then registered. */
export const uploadFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      fileName: z.string().trim().min(1).max(200),
      base64: z
        .string()
        .min(4)
        .max(Math.ceil((FISCAL_MAX_BYTES * 4) / 3) + 8),
      docType: z.enum(["payroll_evidence", "nfse", "nfe", "freelance_document"]),
      modality: z.enum(["nfse", "rpa", "recibo"]).nullable(),
      issuerTaxId: z.string().trim().min(11).max(20),
      takerTaxId: z.string().trim().max(20).nullable(),
      amount: z.number().positive().max(1e12),
      currency: z.string().regex(/^[A-Z]{3}$/),
      documentNumber: z.string().trim().min(1).max(60),
      issuedOn: day,
      deliveryId: id.nullable(),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    const bin = atob(data.base64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    if (bytes.length < 1 || bytes.length > FISCAL_MAX_BYTES)
      throw new Error("Arquivo deve ter até 10 MB.");
    const mime = sniffFiscalMime(bytes);
    if (!mime) throw new Error("Conteúdo não reconhecido como PDF, XML, PNG ou JPEG.");
    const hex = (b: ArrayBuffer) =>
      Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
    const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
    const reserved = await workRpc<{ id: string; path: string }>(
      context.supabase,
      "hiring_fiscal_reserve",
      {
        w,
        i: data.id,
        p_file_name: data.fileName,
        p_mime: mime,
        p_size: bytes.length,
        p_operation: data.operation,
      },
    );
    const bucket = context.supabase.storage.from("hiring-fiscal-documents");
    const up = await bucket.upload(reserved.path, bytes, { contentType: mime, upsert: false });
    if (up.error && !/exists|duplicate/i.test(up.error.message))
      throw new Error("Falha ao armazenar o arquivo privado.");
    const { attestReservedFiscalFile } = await import("./fiscal-attestation.server");
    await attestReservedFiscalFile({
      workspaceId: w,
      requestId: data.id,
      documentId: reserved.id,
      actorId: context.userId,
      path: reserved.path,
      sha256: digest,
      size: bytes.length,
      mime,
    });
    return {
      id: await workRpc<string>(context.supabase, "hiring_fiscal_register", {
        w,
        i: data.id,
        p_doc: reserved.id,
        p_sha256: digest,
        p_doc_type: data.docType,
        p_modality: data.modality,
        p_issuer: data.issuerTaxId,
        p_taker: data.takerTaxId,
        p_amount: data.amount,
        p_currency: data.currency,
        p_number: data.documentNumber,
        p_issued: data.issuedOn,
        p_delivery: data.deliveryId,
      }),
    };
  });

export const reviewFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      documentId: id,
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      decision: z.enum(["verified", "rejected"]),
      reason: z.string().trim().min(5).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return {
      id: await workRpc<string>(context.supabase, "hiring_fiscal_review", {
        w,
        i: data.id,
        p_doc: data.documentId,
        p_sha256: data.sha256,
        p_decision: data.decision,
        p_reason: data.reason,
        p_operation: data.operation,
      }),
    };
  });

/** Authenticated download through the caller's storage policy; bytes are re-hashed against the registered SHA-256. */
export const downloadFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id, documentId: id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    const doc = await workRpc<{
      path: string;
      sha256: string;
      file_name: string;
      mime_type: string;
    }>(context.supabase, "hiring_fiscal_open", { w, i: data.id, p_doc: data.documentId });
    const file = await context.supabase.storage.from("hiring-fiscal-documents").download(doc.path);
    if (file.error) throw new Error("Arquivo indisponível.");
    const buf = new Uint8Array(await file.data.arrayBuffer());
    const got = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    if (got !== doc.sha256) throw new Error("Integridade do arquivo não confere com o registro.");
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000)
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { fileName: doc.file_name, mimeType: doc.mime_type, base64: btoa(bin) };
  });
