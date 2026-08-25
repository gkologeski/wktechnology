import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

// ---------- Admin (authenticated) ----------

export const listEsignDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("esign_documents")
      .select(
        "*, esign_signers(id, document_id, owner_id, name, email, sign_order, status, public_token, viewed_at, signed_at, signed_name, declined_at, decline_reason, created_at)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getEsignDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: doc, error: e1 }, { data: signers, error: e2 }, { data: audit, error: e3 }] =
      await Promise.all([
        supabase.from("esign_documents").select("*").eq("id", data.id).single(),
        supabase
          .from("esign_signers")
          .select(
            "id, document_id, owner_id, name, email, sign_order, status, public_token, viewed_at, signed_at, signed_name, declined_at, decline_reason, created_at",
          )
          .eq("document_id", data.id)
          .order("sign_order"),
        supabase
          .from("esign_audit")
          .select("*")
          .eq("document_id", data.id)
          .order("created_at", { ascending: false }),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);
    return { doc, signers: signers ?? [], audit: audit ?? [] };
  });

export const createEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        body: z.string().max(50000).default(""),
        ordered: z.boolean().default(false),
        dealId: z.string().uuid().nullable().optional(),
        contactId: z.string().uuid().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        signers: z
          .array(
            z.object({
              name: z.string().min(1).max(255),
              email: z.string().email().max(255),
              sign_order: z.number().int().min(1).default(1),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: doc, error } = await supabase
      .from("esign_documents")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        title: data.title,
        description: data.description ?? null,
        body: data.body,
        ordered: data.ordered,
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        expires_at: data.expiresAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const signersInsert = data.signers.map((s) => ({
      document_id: doc.id,
      owner_id: userId,
      workspace_id: workspaceId,
      name: s.name,
      email: s.email,
      sign_order: s.sign_order,
    }));
    const { error: e2 } = await supabase.from("esign_signers").insert(signersInsert);
    if (e2) throw new Error(e2.message);
    await supabase.from("esign_audit").insert({
      document_id: doc.id,
      owner_id: userId,
      workspace_id: workspaceId,
      event: "created",
    });
    return doc;
  });

export const updateEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(1).max(255).optional(),
          description: z.string().max(2000).nullable().optional(),
          body: z.string().max(50000).optional(),
          ordered: z.boolean().optional(),
          expires_at: z.string().nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("esign_documents")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("esign_documents")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase
      .from("esign_audit")
      .insert({ document_id: data.id, owner_id: userId, workspace_id: workspaceId, event: "sent" });
    return { ok: true };
  });

export const cancelEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("esign_documents")
      .update({ status: "canceled", completed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("esign_audit").insert({
      document_id: data.id,
      owner_id: userId,
      workspace_id: workspaceId,
      event: "canceled",
    });
    return { ok: true };
  });

export const deleteEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("esign_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addEsignSigner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        documentId: z.string().uuid(),
        name: z.string().min(1).max(255),
        email: z.string().email().max(255),
        sign_order: z.number().int().min(1).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase.from("esign_signers").insert({
      document_id: data.documentId,
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      email: data.email,
      sign_order: data.sign_order,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeEsignSigner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("esign_signers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Public (token-based, no auth) ----------

export const getEsignSession = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().min(10).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signer, error } = await supabaseAdmin
      .from("esign_signers")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !signer) throw new Error("Link inválido ou expirado.");

    const { data: doc, error: e2 } = await supabaseAdmin
      .from("esign_documents")
      .select("id,title,description,body,status,ordered,expires_at")
      .eq("id", signer.document_id)
      .single();
    if (e2 || !doc) throw new Error("Documento não encontrado.");

    const { data: allSigners } = await supabaseAdmin
      .from("esign_signers")
      .select("id,name,email,sign_order,status,signed_at")
      .eq("document_id", doc.id)
      .order("sign_order");

    // ordered: bloquear se algum anterior não assinou
    let canSign = signer.status === "pending" || signer.status === "viewed";
    if (doc.ordered && canSign) {
      const blockers = (allSigners ?? []).filter(
        (s) => s.sign_order < signer.sign_order && s.status !== "signed",
      );
      if (blockers.length > 0) canSign = false;
    }
    if (doc.status === "canceled" || doc.status === "completed" || doc.status === "declined") {
      canSign = false;
    }

    // marca como visto
    if (!signer.viewed_at) {
      await supabaseAdmin
        .from("esign_signers")
        .update({
          viewed_at: new Date().toISOString(),
          status: signer.status === "pending" ? "viewed" : signer.status,
        })
        .eq("id", signer.id);
      await supabaseAdmin.from("esign_audit").insert({
        document_id: doc.id,
        signer_id: signer.id,
        owner_id: signer.owner_id,
        event: "viewed",
      });
    }

    return { doc, signer, signers: allSigners ?? [], canSign };
  });

export const submitEsignSignature = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(10).max(100),
        signedName: z.string().min(2).max(255),
        signatureData: z.string().max(500_000).optional(), // dataURL opcional do canvas
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = getRequestHeader("x-forwarded-for") ?? getRequestHeader("cf-connecting-ip") ?? null;
    const ua = getRequestHeader("user-agent") ?? null;

    const { data: signer, error } = await supabaseAdmin
      .from("esign_signers")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !signer) throw new Error("Link inválido.");
    if (signer.status === "signed") throw new Error("Você já assinou este documento.");
    if (signer.status === "declined") throw new Error("Assinatura recusada anteriormente.");

    const { error: e2 } = await supabaseAdmin
      .from("esign_signers")
      .update({
        status: "signed",
        signed_name: data.signedName,
        signature_data: data.signatureData ?? null,
        ip_address: ip,
        user_agent: ua,
        signed_at: new Date().toISOString(),
      })
      .eq("id", signer.id);
    if (e2) throw new Error(e2.message);

    await supabaseAdmin.from("esign_audit").insert({
      document_id: signer.document_id,
      signer_id: signer.id,
      owner_id: signer.owner_id,
      event: "signed",
      ip_address: ip,
      user_agent: ua,
    });

    // Se este documento estiver ligado a uma oferta do ATS, emitir ats.offer.signed.
    try {
      const { data: offer } = await supabaseAdmin
        .from("ats_offers")
        .select("id, owner_id, candidate_id, job_id, application_id")
        .eq("esign_document_id", signer.document_id)
        .maybeSingle();
      if (offer?.id && offer.owner_id) {
        const { recordAtsEvent } = await import("./ats/audit.server");
        await recordAtsEvent(supabaseAdmin, {
          ownerId: offer.owner_id as string,
          name: "ats.offer.signed",
          entityType: "offer",
          entityId: offer.id as string,
          dedupeKey: `ats.offer.signed:${offer.id}`,
          payload: {
            offerId: offer.id,
            candidateId: offer.candidate_id,
            jobId: offer.job_id,
            applicationId: offer.application_id,
            esignDocumentId: signer.document_id,
            signerId: signer.id,
          },
        });
      }
    } catch (e) {
      console.warn("[submitEsignSignature] ats.offer.signed emit failed", e);
    }

    return { ok: true };
  });

export const declineEsign = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(10).max(100),
        reason: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = getRequestHeader("x-forwarded-for") ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const { data: signer, error } = await supabaseAdmin
      .from("esign_signers")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !signer) throw new Error("Link inválido.");
    const { error: e2 } = await supabaseAdmin
      .from("esign_signers")
      .update({
        status: "declined",
        decline_reason: data.reason ?? null,
        declined_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: ua,
      })
      .eq("id", signer.id);
    if (e2) throw new Error(e2.message);
    await supabaseAdmin.from("esign_audit").insert({
      document_id: signer.document_id,
      signer_id: signer.id,
      owner_id: signer.owner_id,
      event: "declined",
      ip_address: ip,
      user_agent: ua,
      metadata: { reason: data.reason ?? null },
    });
    return { ok: true };
  });
