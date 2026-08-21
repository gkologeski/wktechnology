// Server functions para Ofertas (ats_offers) com integração eSign.
// Fluxo:
//  - createOffer: cria registro draft.
//  - sendOffer: cria documento eSign (signer = candidato), envia e linka esign_document_id.
//  - Quando o candidato assina, o trigger de DB marca a oferta como signed
//    e promove a etapa configurada em ats_applications.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { recordAtsEvent } from "./audit.server";
import { buildGridSelect } from "@/lib/grid/dynamic-select";
import { atsGridInputSchema, type AtsGridInput } from "@/lib/grid/ats-grid-input";

const BASE_OFFER_KEYS = [
  "id",
  "title",
  "status",
  "salary_amount",
  "salary_currency",
  "start_date",
  "sent_at",
  "signed_at",
  "declined_at",
  "created_at",
  "candidate_id",
  "job_id",
  "application_id",
  "esign_document_id",
] as const;

type OfferListRow = {
  id: string;
  title: string;
  status: string;
  salary_amount: number | null;
  salary_currency: string | null;
  start_date: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
  candidate_id: string | null;
  job_id: string | null;
  application_id: string | null;
  esign_document_id: string | null;
  ats_candidates: { full_name: string; email: string | null } | null;
  ats_jobs: { title: string } | null;
};

const OfferInsert = z.object({
  candidate_id: z.string().uuid(),
  application_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(255).default("Carta-proposta"),
  body: z.string().max(50000).default(""),
  salary_amount: z.number().nonnegative().nullable().optional(),
  salary_currency: z.string().min(1).max(8).default("BRL"),
  start_date: z.string().nullable().optional(),
  promote_to_stage: z.string().max(100).nullable().optional(),
});

export const listOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AtsGridInput | undefined) => atsGridInputSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { resolveAtsGridProjection } = await import("./grid-projection.server");
    const projection = await resolveAtsGridProjection(supabase, userId, "ats_offers", data);
    const base = buildGridSelect(BASE_OFFER_KEYS, projection.extras);
    const { data: rows, error } = await supabase
      .from("ats_offers")
      .select(`${base}, ats_candidates(full_name, email), ats_jobs(title)`)
      .order(projection.sortKey ?? "created_at", {
        ascending: projection.sortKey ? projection.sortDir === "asc" : false,
        nullsFirst: false,
      });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as OfferListRow[];
  });


export const getOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ats_offers")
      .select(
        "*, ats_candidates(full_name, email), ats_jobs(title), esign_documents(id, status, sent_at, completed_at)",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferInsert.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ats_offers")
      .insert({
        owner_id: userId,
        candidate_id: data.candidate_id,
        application_id: data.application_id ?? null,
        job_id: data.job_id ?? null,
        title: data.title,
        body: data.body,
        salary_amount: data.salary_amount ?? null,
        salary_currency: data.salary_currency,
        start_date: data.start_date ?? null,
        promote_to_stage: data.promote_to_stage ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: OfferInsert.partial(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ats_offers")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: offer, error: e0 } = await supabase
      .from("ats_offers")
      .select("*, ats_candidates(full_name, email)")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (offer.status !== "draft") throw new Error("Apenas ofertas em rascunho podem ser enviadas.");
    const cand = offer.ats_candidates as { full_name: string; email: string | null } | null;
    if (!cand?.email) throw new Error("Candidato sem e-mail para assinatura.");

    let esignId = offer.esign_document_id as string | null;
    if (!esignId) {
      // Cria documento de eSign com o candidato como signatário único.
      const { data: doc, error: e1 } = await supabase
        .from("esign_documents")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          title: offer.title,
          body: offer.body,
          ordered: false,
        })
        .select("id")
        .single();
      if (e1) throw new Error(e1.message);
      esignId = doc.id as string;
      const { error: e2 } = await supabase.from("esign_signers").insert({
        document_id: esignId,
        owner_id: userId,
        workspace_id: workspaceId,
        name: cand.full_name,
        email: cand.email,
        sign_order: 1,
      });
      if (e2) throw new Error(e2.message);
      await supabase.from("esign_audit").insert({
        document_id: esignId,
        owner_id: userId,
        workspace_id: workspaceId,
        event: "created",
      });
    }

    const nowIso = new Date().toISOString();
    const { error: e3 } = await supabase
      .from("esign_documents")
      .update({ status: "sent", sent_at: nowIso })
      .eq("id", esignId);
    if (e3) throw new Error(e3.message);
    await supabase.from("esign_audit").insert({
      document_id: esignId,
      owner_id: userId,
      workspace_id: workspaceId,
      event: "sent",
    });

    const publicToken =
      (offer.public_token as string | null) ??
      (crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""));

    const { error: e4 } = await supabase
      .from("ats_offers")
      .update({ status: "sent", sent_at: nowIso, esign_document_id: esignId, public_token: publicToken })
      .eq("id", offer.id);
    if (e4) throw new Error(e4.message);

    await recordAtsEvent(supabase, {
      ownerId: userId,
      name: "ats.offer.approved",
      entityType: "offer",
      entityId: offer.id as string,
      dedupeKey: `ats.offer.approved:${offer.id}`,
      payload: {
        offerId: offer.id,
        candidateId: offer.candidate_id,
        jobId: offer.job_id,
        applicationId: offer.application_id,
        esignDocumentId: esignId,
      },
    }).catch(() => undefined);

    return { ok: true, esign_document_id: esignId, public_token: publicToken };
  });

export const cancelOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: offer, error: e0 } = await supabase
      .from("ats_offers")
      .select("esign_document_id, status")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (offer.esign_document_id) {
      await supabase
        .from("esign_documents")
        .update({ status: "canceled", completed_at: new Date().toISOString() })
        .eq("id", offer.esign_document_id);
      await supabase.from("esign_audit").insert({
        document_id: offer.esign_document_id,
        owner_id: userId,
        workspace_id: workspaceId,
        event: "canceled",
      });
    }
    const { error } = await supabase
      .from("ats_offers")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ats_offers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
