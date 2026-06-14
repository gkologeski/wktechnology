import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlaybookInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  channel: z.enum(["whatsapp", "call", "email"]).default("whatsapp"),
  enabled: z.boolean().default(true),
  max_messages: z.number().int().min(1).max(20).default(5),
  business_hours: z
    .object({
      tz: z.string().default("America/Sao_Paulo"),
      start: z.string().default("09:00"),
      end: z.string().default("18:00"),
      weekdays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    })
    .default({ tz: "America/Sao_Paulo", start: "09:00", end: "18:00", weekdays: [1, 2, 3, 4, 5] }),
  opt_out_phrases: z.array(z.string()).default(["pare", "sair", "stop"]),
  steps: z
    .array(
      z.object({
        delay_hours: z.number().int().min(0).max(720).default(0),
        template: z.string().min(1).max(2000),
      }),
    )
    .default([]),
  qualification_prompt: z.string().max(2000).nullable().optional(),
  handoff_score: z.number().int().min(0).max(100).default(70),
});

export const listPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sdr_playbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlaybookInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, owner_id: userId, updated_at: new Date().toISOString() };
    const { data: out, error } = await supabase
      .from("sdr_playbooks")
      .upsert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: out };
  });

export const deletePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("sdr_playbooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ status: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("sdr_enrollments")
      .select(
        "id, status, messages_sent, last_action_at, handoff_at, qualification_score, lead_id, contact_id, playbook_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const enrollLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ playbook_id: z.string().uuid(), lead_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: out, error } = await supabase
      .from("sdr_enrollments")
      .insert({
        owner_id: userId,
        playbook_id: data.playbook_id,
        lead_id: data.lead_id,
        status: "active",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: out };
  });

export const requestHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ enrollment_id: z.string().uuid(), reason: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("sdr_enrollments")
      .update({
        status: "handed_off",
        handoff_at: new Date().toISOString(),
        handoff_reason: data.reason ?? null,
      })
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
