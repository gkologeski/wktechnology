import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import type { Database } from "@/integrations/supabase/types";
import { offerRpc } from "./ats/offer-rpc.server";
import { emailSchema } from "@/lib/email-schema";
import { workspaceOfSource } from "@/lib/workspace-source.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";

// ---------- Admin (authenticated) ----------

export const listEsignDocuments = createServerFn({ method: "GET" })
  .middleware([requireWorkPermission("techcontracts.esign", "view")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("esign_documents")
      .select(
        "*, esign_signers(id, document_id, owner_id, name, email, sign_order, status, viewed_at, signed_at, signed_name, declined_at, decline_reason, created_at)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getEsignDocument = createServerFn({ method: "GET" })
  .middleware([requireWorkPermission("techcontracts.esign", "view")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: doc, error: e1 }, { data: signers, error: e2 }, { data: audit, error: e3 }] =
      await Promise.all([
        supabase.from("esign_documents").select("*").eq("id", data.id).single(),
        supabase
          .from("esign_signers")
          .select(
            "id, document_id, owner_id, name, email, sign_order, status, viewed_at, signed_at, signed_name, declined_at, decline_reason, created_at",
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
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const { data: mayShare } = await (supabase.rpc as any)("work_record_access", {
      r: "techcontracts.esign",
      i: data.id,
      a: "share",
    });
    const links = mayShare
      ? await workRpc<Array<{ id: string; public_token: string }>>(
          supabase,
          "contract_esign_manage",
          { p_action: "share", p_id: data.id, p_data: {} },
        )
      : [];
    const safeSigners = (signers ?? []).map((s) => ({
      ...s,
      public_token: links.find((l) => l.id === s.id)?.public_token ?? null,
    }));
    return { doc, signers: safeSigners, audit: audit ?? [] };
  });

export const createEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "create")])
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
              email: emailSchema(255),
              sign_order: z.number().int().min(1).default(1),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<Database["public"]["Tables"]["esign_documents"]["Row"]>(
      context.supabase,
      "contract_esign_manage",
      { p_action: "create", p_id: null, p_data: data },
    );
  });

export const updateEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "update")])
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
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "update",
      p_id: data.id,
      p_data: data.patch,
    });
  });

export const sendEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "send")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "send",
      p_id: data.id,
      p_data: {},
    });
  });

export const cancelEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "cancel")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "cancel",
      p_id: data.id,
      p_data: {},
    });
  });

export const deleteEsignDocument = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "delete")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "delete",
      p_id: data.id,
      p_data: {},
    });
  });

export const addEsignSigner = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "manage")])
  .inputValidator((d) =>
    z
      .object({
        documentId: z.string().uuid(),
        name: z.string().min(1).max(255),
        email: emailSchema(255),
        sign_order: z.number().int().min(1).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "add_signer",
      p_id: data.documentId,
      p_data: data,
    });
  });

export const removeEsignSigner = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "manage")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return await workRpc<{ ok: boolean }>(context.supabase, "contract_esign_manage", {
      p_action: "remove_signer",
      p_id: data.id,
      p_data: {},
    });
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
    const workspaceId = await workspaceOfSource(
      supabaseAdmin,
      "esign_documents",
      signer.document_id,
    );
    if (signer.workspace_id !== workspaceId)
      throw new Error("Signatário e documento pertencem a empresas diferentes.");

    const { data: doc, error: e2 } = await supabaseAdmin
      .from("esign_documents")
      .select("id,title,description,body,status,ordered,expires_at")
      .eq("id", signer.document_id)
      .single();
    if (e2 || !doc) throw new Error("Documento não encontrado.");
    if (doc.status === "canceled") throw new Error("Link inválido ou expirado.");

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
    if (doc.status === "completed" || doc.status === "declined") {
      canSign = false;
    }

    const { data: linkedOffer } = await supabaseAdmin
      .from("ats_offers")
      .select("id")
      .eq("esign_document_id", doc.id)
      .maybeSingle();
    if (linkedOffer) {
      await offerRpc(supabaseAdmin, "ats_offer_sign", { _token: data.token, _action: "view" });
    } else {
      const { workRpc } = await import("@/lib/access-control/work-core.server");
      return workRpc<EsignSession>(supabaseAdmin, "contract_esign_public", {
        p_token: data.token,
        p_action: "view",
      });
    }
    return {
      doc,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        status: signer.status,
        signed_name: signer.signed_name,
        signed_at: signer.signed_at,
        decline_reason: signer.decline_reason,
      },
      signers: (allSigners ?? []).map(({ email, ...rest }) => rest),
      canSign,
    };
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
    const workspaceId = await workspaceOfSource(
      supabaseAdmin,
      "esign_documents",
      signer.document_id,
    );
    if (signer.workspace_id !== workspaceId)
      throw new Error("Signatário e documento pertencem a empresas diferentes.");
    if (signer.status === "signed") throw new Error("Você já assinou este documento.");
    if (signer.status === "declined") throw new Error("Assinatura recusada anteriormente.");

    const { data: linkedOffer } = await supabaseAdmin
      .from("ats_offers")
      .select("id, owner_id, candidate_id, job_id, application_id")
      .eq("esign_document_id", signer.document_id)
      .maybeSingle();
    if (linkedOffer) {
      const result = await offerRpc<{ completed: boolean }>(supabaseAdmin, "ats_offer_sign", {
        _token: data.token,
        _action: "sign",
        _name: data.signedName,
        _signature: data.signatureData ?? null,
        _ip: ip,
        _ua: ua,
      });
      if (result.completed && linkedOffer.owner_id) {
        const { recordAtsEvent } = await import("./ats/audit.server");
        await recordAtsEvent(supabaseAdmin, {
          ownerId: linkedOffer.owner_id,
          name: "ats.offer.signed",
          entityType: "offer",
          entityId: linkedOffer.id,
          dedupeKey: `ats.offer.signed:${linkedOffer.id}`,
          payload: {
            offerId: linkedOffer.id,
            applicationId: linkedOffer.application_id,
            jobId: linkedOffer.job_id,
            candidateId: linkedOffer.candidate_id,
          },
        }).catch(() => undefined);
      }
      return { ok: true };
    }
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(supabaseAdmin, "contract_esign_public", {
      p_token: data.token,
      p_action: "sign",
      p_name: data.signedName,
      p_signature: data.signatureData ?? null,
      p_ip: ip,
      p_ua: ua,
    });
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
    const workspaceId = await workspaceOfSource(
      supabaseAdmin,
      "esign_documents",
      signer.document_id,
    );
    if (signer.workspace_id !== workspaceId)
      throw new Error("Signatário e documento pertencem a empresas diferentes.");
    const { data: linkedOffer } = await supabaseAdmin
      .from("ats_offers")
      .select("id, owner_id, candidate_id, job_id, application_id")
      .eq("esign_document_id", signer.document_id)
      .maybeSingle();
    if (linkedOffer) {
      await offerRpc<{ completed: boolean }>(supabaseAdmin, "ats_offer_sign", {
        _token: data.token,
        _action: "decline",
        _reason: data.reason ?? null,
        _ip: ip,
        _ua: ua,
      });

      return { ok: true };
    }
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(supabaseAdmin, "contract_esign_public", {
      p_token: data.token,
      p_action: "decline",
      p_reason: data.reason ?? null,
      p_ip: ip,
      p_ua: ua,
    });
  });

type EsignSession = {
  doc: Pick<
    Database["public"]["Tables"]["esign_documents"]["Row"],
    "id" | "title" | "description" | "body" | "status" | "ordered" | "expires_at"
  >;
  signer: Pick<
    Database["public"]["Tables"]["esign_signers"]["Row"],
    "id" | "name" | "email" | "status" | "signed_name" | "signed_at" | "decline_reason"
  >;
  signers: Array<
    Pick<
      Database["public"]["Tables"]["esign_signers"]["Row"],
      "id" | "name" | "sign_order" | "status" | "signed_at"
    >
  >;
  canSign: boolean;
};
