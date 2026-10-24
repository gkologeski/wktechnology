// Approval, signing availability and hiring are independent business actions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { atsGridInputSchema, type AtsGridInput } from "@/lib/grid/ats-grid-input";
import { offerRpc } from "./offer-rpc.server";
import { recordAtsEvent } from "./audit.server";

export type OfferListRow = {
  id: string;
  title: string;
  status: string;
  salary_amount: number | null;
  salary_currency: string | null;
  body: string | null;
  start_date: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
  candidate_id: string;
  job_id: string | null;
  application_id: string | null;
  esign_document_id: string | null;
  approval_status: "not_requested" | "pending" | "approved" | "rejected";
  approval_note: string | null;
  revision: number;
  approved_revision: number | null;
  can_view_terms: boolean;
  can_edit_terms: boolean;
  can_request: boolean;
  can_approve: boolean;
  can_send: boolean;
  can_cancel: boolean;
  can_delete: boolean;
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
  start_date: z.string().date().nullable().optional(),
  promote_to_stage: z.string().max(100).nullable().optional(),
});
const Transition = z.object({ id: z.string().uuid(), revision: z.number().int().positive() });

export const listOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AtsGridInput | undefined) => atsGridInputSchema.parse(d ?? {}))
  .handler(async ({ context }) =>
    offerRpc<OfferListRow[]>(context.supabase, "ats_offer_projection", {}),
  );
export const getOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const rows = await offerRpc<OfferListRow[]>(context.supabase, "ats_offer_projection", {
      _offer: data.id,
    });
    if (!rows[0]) throw new Error("Oferta indisponível ou sem permissão.");
    return rows[0];
  });
export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferInsert.parse(d))
  .handler(async ({ context, data }) => {
    const workspaceId = await getActiveWorkspaceId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("ats_offers")
      .insert({ ...data, owner_id: context.userId, workspace_id: workspaceId, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, revision: 1 };
  });
export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        revision: z.number().int().positive(),
        patch: OfferInsert.partial(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_offers")
      .update(data.patch)
      .eq("id", data.id)
      .eq("revision", data.revision)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Oferta indisponível ou sem permissão para editar.");
    return { ok: true };
  });
export const reviewOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Transition.extend({
      action: z.enum(["request", "approve", "reject"]),
      note: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const result = await offerRpc<{ ok: boolean }>(context.supabase, "ats_offer_transition", {
      _id: data.id,
      _action: data.action,
      _revision: data.revision,
      _note: data.note ?? null,
    });
    if (data.action === "approve") {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.offer.approved",
        entityType: "offer",
        entityId: data.id,
        dedupeKey: `ats.offer.approved:${data.id}:${data.revision}`,
        payload: { offerId: data.id, revision: data.revision },
      }).catch(() => undefined);
    }
    return result;
  });
export const sendOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Transition.parse(d))
  .handler(async ({ context, data }) =>
    offerRpc<{ ok: boolean; esign_document_id: string; public_token: string }>(
      context.supabase,
      "ats_offer_transition",
      {
        _id: data.id,
        _action: "send",
        _revision: data.revision,
      },
    ),
  );
export const cancelOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Transition.parse(d))
  .handler(async ({ context, data }) =>
    offerRpc<{ ok: boolean }>(context.supabase, "ats_offer_transition", {
      _id: data.id,
      _action: "cancel",
      _revision: data.revision,
    }),
  );
export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_offers")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Oferta indisponível ou sem permissão para excluir.");
    return { ok: true };
  });

export const getOfferLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    offerRpc<string>(context.supabase, "ats_offer_link", { _id: data.id }),
  );
export const canCreateOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    OfferInsert.pick({ candidate_id: true, job_id: true, application_id: true }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const workspaceId = await getActiveWorkspaceId(context.supabase, context.userId);
    const row = {
      ...data,
      workspace_id: workspaceId,
      owner_id: context.userId,
      assigned_to: context.userId,
    };
    const create = await offerRpc<boolean>(context.supabase, "ats_offer_action_access", {
      _row: row,
      _action: "create",
    });
    const terms = await offerRpc<boolean>(context.supabase, "ats_offer_action_access", {
      _row: row,
      _action: "terms_update",
    });
    return create && terms;
  });
