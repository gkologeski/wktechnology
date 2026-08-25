/**
 * Referrals — Onda 5 / Slice 2 / Fase 4.
 *
 * Programa de indicações: colaboradores submetem indicações; admins decidem,
 * marcam aceitação/contratação e gerenciam o bônus (pending → eligible →
 * approved → paid). RLS já garante visibilidade.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

export const listReferralPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_referral_programs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { programs: data ?? [] };
  });

export const upsertReferralProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        enabled: z.boolean().default(true),
        default_bonus_cents: z.number().int().min(0).default(0),
        currency: z.string().min(3).max(3).default("BRL"),
        terms_url: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const row = {
      ...(data.id ? { id: data.id } : { created_by: context.userId }),
      owner_id: context.userId,
      name: data.name,
      enabled: data.enabled,
      default_bonus_cents: data.default_bonus_cents,
      currency: data.currency,
      terms_url: data.terms_url ?? null,
    };
    const { data: saved, error } = await context.supabase
      .from("ats_referral_programs")
      .upsert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

export const updateReferralProgramPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        public_slug: z
          .string()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9-]+$/)
          .nullable()
          .optional(),
        landing_headline: z.string().max(200).nullable().optional(),
        landing_body: z.string().max(4000).nullable().optional(),
        enable_public_form: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("ats_referral_programs")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scope: z.enum(["mine", "all"]).default("mine"),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("ats_referrals")
      .select(
        "id, status, bonus_cents, bonus_status, candidate_name, candidate_email, candidate_phone, candidate_linkedin, relationship, notes, submitted_at, decided_at, hired_at, bonus_paid_at, referrer_user_id, job_id, candidate_id, job:ats_jobs(id, title)",
      )
      .order("submitted_at", { ascending: false })
      .limit(data.limit);
    if (data.scope === "mine") q = q.eq("referrer_user_id", context.userId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { referrals: rows ?? [] };
  });

export const submitReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        program_id: z.string().uuid().nullable().optional(),
        job_id: z.string().uuid().nullable().optional(),
        candidate_name: z.string().min(1).max(160),
        candidate_email: z.string().email().nullable().optional(),
        candidate_phone: z.string().max(40).nullable().optional(),
        candidate_linkedin: z.string().url().nullable().optional(),
        relationship: z.string().max(120).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // bônus padrão a partir do programa, se houver
    let bonus = 0;
    if (data.program_id) {
      const { data: prog } = await context.supabase
        .from("ats_referral_programs")
        .select("default_bonus_cents")
        .eq("id", data.program_id)
        .maybeSingle();
      bonus = (prog as { default_bonus_cents?: number } | null)?.default_bonus_cents ?? 0;
    }
    const { data: row, error } = await context.supabase
      .from("ats_referrals")
      .insert({
        owner_id: context.userId,
        program_id: data.program_id ?? null,
        referrer_user_id: context.userId,
        job_id: data.job_id ?? null,
        candidate_name: data.candidate_name,
        candidate_email: data.candidate_email ?? null,
        candidate_phone: data.candidate_phone ?? null,
        candidate_linkedin: data.candidate_linkedin ?? null,
        relationship: data.relationship ?? null,
        notes: data.notes ?? null,
        bonus_cents: bonus,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.referral.submitted",
      entityType: "referral",
      entityId: row.id,
      payload: { job_id: data.job_id ?? null },
    });
    return { id: row.id };
  });

export const updateReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z
          .enum([
            "submitted",
            "under_review",
            "accepted",
            "interviewing",
            "hired",
            "rejected",
            "paid",
            "expired",
          ])
          .optional(),
        bonus_status: z.enum(["pending", "eligible", "approved", "paid", "forfeited"]).optional(),
        bonus_cents: z.number().int().min(0).optional(),
        candidate_id: z.string().uuid().nullable().optional(),
        decision_notes: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const finalPatch: Record<string, unknown> = { ...patch };
    if (patch.status === "accepted") finalPatch.decided_at = new Date().toISOString();
    if (patch.status === "hired") finalPatch.hired_at = new Date().toISOString();
    if (patch.bonus_status === "paid") finalPatch.bonus_paid_at = new Date().toISOString();

    const { error } = await context.supabase
      .from("ats_referrals")
      .update(finalPatch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (patch.status === "accepted") {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.referral.accepted",
        entityType: "referral",
        entityId: id,
      });
    }
    if (patch.status === "hired") {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.referral.hired",
        entityType: "referral",
        entityId: id,
      });
    }
    if (patch.bonus_status === "paid") {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.referral.bonus_paid",
        entityType: "referral",
        entityId: id,
      });
    }
    return { ok: true };
  });
