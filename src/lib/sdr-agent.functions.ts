import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSdr } from "@/lib/prospecting/sdr/access.server";

// Telas legadas de /agents/sdr. Toda função resolve o workspace do usuário,
// exige a permissão RBAC do Agente SDR e filtra por workspace (além da RLS).

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
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "view");
    const { data, error } = await supabase
      .from("sdr_playbooks")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlaybookInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, data.id ? "update" : "create");
    const { id, ...fields } = data;
    const now = new Date().toISOString();
    if (id) {
      const { data: out, error } = await supabase
        .from("sdr_playbooks")
        .update({ ...fields, updated_at: now })
        .eq("id", id)
        .eq("workspace_id", ws)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!out) throw new Error("Playbook não encontrado neste workspace.");
      return { item: out };
    }
    const { data: out, error } = await supabase
      .from("sdr_playbooks")
      .insert({ ...fields, owner_id: userId, workspace_id: ws, updated_at: now })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: out };
  });

export const deletePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "delete");
    // Playbook com histórico é desativado, não apagado.
    const { count } = await supabase
      .from("sdr_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("playbook_id", data.id)
      .eq("workspace_id", ws);
    if ((count ?? 0) > 0) {
      const { error } = await supabase
        .from("sdr_playbooks")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      return { ok: true, archived: true };
    }
    const { data: gone, error } = await supabase
      .from("sdr_playbooks")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .select("id");
    if (error) throw new Error(error.message);
    if (!gone?.length) throw new Error("Playbook não encontrado ou sem permissão para excluir.");
    return { ok: true, archived: false };
  });

export const listEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ status: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "view");
    let q = supabase
      .from("sdr_enrollments")
      .select(
        "id, status, messages_sent, last_action_at, handoff_at, qualification_score, lead_id, contact_id, playbook_id, created_at",
      )
      .eq("workspace_id", ws)
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
    const ws = await requireSdr(supabase, userId, "create");
    const [{ data: pb }, { data: lead }] = await Promise.all([
      supabase
        .from("sdr_playbooks")
        .select("id")
        .eq("id", data.playbook_id)
        .eq("workspace_id", ws)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("id")
        .eq("id", data.lead_id)
        .eq("workspace_id", ws)
        .maybeSingle(),
    ]);
    if (!pb) throw new Error("Playbook não encontrado neste workspace.");
    if (!lead) throw new Error("Lead não encontrado neste workspace.");
    const { data: out, error } = await supabase
      .from("sdr_enrollments")
      .insert({
        owner_id: userId,
        workspace_id: ws,
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
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "supervise");
    const { data: enr, error: eErr } = await supabase
      .from("sdr_enrollments")
      .select("id, workspace_id, conversation_id")
      .eq("id", data.enrollment_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!enr) throw new Error("Atendimento não encontrado neste workspace.");
    if (enr.conversation_id) {
      // Mesmo caminho do takeover da Prospecção: trava a IA na conversa.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { handoffToHuman } = await import("@/lib/prospecting/sdr/actions.server");
      await handoffToHuman(supabaseAdmin, {
        workspaceId: ws,
        enrollmentId: enr.id,
        conversationId: enr.conversation_id,
        reason: data.reason ?? "Assumido manualmente",
        actorUserId: userId,
      });
      return { ok: true };
    }
    const { error } = await supabase
      .from("sdr_enrollments")
      .update({
        status: "handed_off",
        handoff_at: new Date().toISOString(),
        handoff_reason: data.reason ?? null,
      })
      .eq("id", enr.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
