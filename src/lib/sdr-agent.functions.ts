import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
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
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "view")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "view");
    const [{ data, error }, settings] = await Promise.all([
      supabase
        .from("sdr_playbooks")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false }),
      supabase
        .from("sdr_workspace_settings")
        .select("default_playbook_id")
        .eq("workspace_id", ws)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    return {
      items: data ?? [],
      defaultPlaybookId: (settings.data?.default_playbook_id as string | null) ?? null,
    };
  });

/** Define o agente principal (⭐) do workspace. */
export const setDefaultPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "update")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "sdr_playbooks", data.id, "update");

    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "manage");
    const { data: ro } = await supabase.rpc("is_read_only_view");
    if (ro) throw new Error("No modo Ver como não é possível alterar o agente principal.");
    const { data: pb, error: pbErr } = await supabase
      .from("sdr_playbooks")
      .select("id, enabled")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (pbErr) throw new Error(pbErr.message);
    if (!pb) throw new Error("Agente não encontrado neste workspace.");
    if (!pb.enabled) throw new Error("Agente desativado não pode ser o principal.");
    const { data: out, error } = await supabase
      .from("sdr_workspace_settings")
      .upsert(
        {
          workspace_id: ws,
          default_playbook_id: data.id,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" },
      )
      .select("default_playbook_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (out?.default_playbook_id !== data.id)
      throw new Error("Sem permissão para alterar o agente principal.");
    return { defaultPlaybookId: data.id };
  });

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", ["create", "update"])])
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
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "delete");
    // Agente com histórico, versão publicada ou vínculo em campanha/configuração
    // é desativado, não apagado (a exclusão apagaria versões e soltaria vínculos).
    const head = { count: "exact" as const, head: true };
    const [enr, pub, camp, cfg] = await Promise.all([
      supabase
        .from("sdr_enrollments")
        .select("id", head)
        .eq("playbook_id", data.id)
        .eq("workspace_id", ws),
      supabase
        .from("sdr_agent_versions")
        .select("id", head)
        .eq("playbook_id", data.id)
        .eq("workspace_id", ws)
        .neq("status", "draft"),
      supabase.from("whatsapp_campaigns").select("id", head).eq("sdr_playbook_id", data.id),
      supabase
        .from("sdr_workspace_settings")
        .select("workspace_id", head)
        .eq("default_playbook_id", data.id),
    ]);
    const linked = [enr, pub, camp, cfg].some((r) => r.error || (r.count ?? 0) > 0);
    if (linked) {
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

/** Edição rápida do agente (nome) a partir de "Persona e teste". */
export const renamePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "update")])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "sdr_playbooks", data.id, "update");

    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "update");
    const { data: out, error } = await supabase
      .from("sdr_playbooks")
      .update({ name: data.name, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!out) throw new Error("Agente não encontrado ou sem permissão para editar.");
    return { ok: true };
  });

export const listEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "view")])
  .inputValidator((input) => z.object({ status: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await requireSdr(supabase, userId, "view");
    let q = supabase
      .from("sdr_enrollments")
      .select(
        "id, status, commercial_stage, contact_phone, conversation_id, messages_sent, last_action_at, handoff_at, qualification_score, lead_id, contact_id, playbook_id, created_at",
      )
      .eq("workspace_id", ws)
      .order("last_action_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    // Totais por situação, contados no banco sob RLS (nunca pela página carregada).
    const countBy = (status?: string) => {
      let c = supabase
        .from("sdr_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws);
      if (status) c = c.eq("status", status);
      return c;
    };
    const STATUSES = ["active", "paused", "handoff", "opted_out"] as const;
    const [{ data: rows, error }, total, ...byStatus] = await Promise.all([
      q,
      countBy(),
      ...STATUSES.map((s) => countBy(s)),
    ]);
    if (error) throw new Error(error.message);
    const countError = [total, ...byStatus].find((r) => r.error)?.error;
    const counts = countError
      ? null
      : {
          total: total.count ?? 0,
          ...Object.fromEntries(STATUSES.map((s, i) => [s, byStatus[i].count ?? 0])),
        };
    const items = rows ?? [];
    // Nomes lidos com o cliente do usuário: sem acesso ao registro, o nome fica vazio.
    const idsOf = (k: "contact_id" | "lead_id" | "playbook_id") =>
      [...new Set(items.map((r) => r[k]).filter((v): v is string => !!v))];
    const people = async (table: "contacts" | "leads", ids: string[]) => {
      const out: Record<string, { first_name: string | null; last_name: string | null; company_name: string | null }> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const { data: chunk } = await supabase
          .from(table)
          .select("id, first_name, last_name, company_name")
          .eq("workspace_id", ws)
          .in("id", ids.slice(i, i + 100));
        for (const p of chunk ?? []) out[p.id] = p;
      }
      return out;
    };
    const [contacts, leads, agentRows] = await Promise.all([
      people("contacts", idsOf("contact_id")),
      people("leads", idsOf("lead_id")),
      idsOf("playbook_id").length
        ? supabase
            .from("sdr_playbooks")
            .select("id, name")
            .eq("workspace_id", ws)
            .in("id", idsOf("playbook_id"))
            .then((r) => r.data ?? [])
        : Promise.resolve([] as Array<{ id: string; name: string }>),
    ]);
    const agents = Object.fromEntries(agentRows.map((a) => [a.id, a.name]));
    return {
      items: items.map((r) => {
        const person = r.contact_id ? contacts[r.contact_id] : r.lead_id ? leads[r.lead_id] : null;
        return {
          ...r,
          person: person
            ? {
                first_name: person.first_name,
                last_name: person.last_name,
                company_name: person.company_name,
              }
            : null,
          agent_name: r.playbook_id ? (agents[r.playbook_id] ?? null) : null,
        };
      }),
      counts,
    };
  });

export const enrollLead = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "create")])
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
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "update")])
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
    await assertSalesRecord(supabase, "sdr_enrollments", enr.id, "update");
    if (enr.conversation_id) {
      await assertSalesRecord(supabase, "whatsapp_conversations", enr.conversation_id, "update");
      await assertSalesRecord(supabase, "whatsapp_conversations", enr.conversation_id, "assign");
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

const AiOwnerInput = z.object({ conversation_id: z.string().uuid() });

/** Quem atende a conversa de WhatsApp: agente (ai), pessoa (human) ou pausado. */
export const getConversationAiOwner = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "view")])
  .inputValidator((input) => AiOwnerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveSdrWorkspace } = await import("@/lib/prospecting/sdr/access.server");
    const ws = await resolveSdrWorkspace(supabase, userId);
    const { data: conv, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, ai_owner")
      .eq("id", data.conversation_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let canSupervise = false;
    try {
      await requireSdr(supabase, userId, "supervise");
      canSupervise = true;
    } catch {
      canSupervise = false;
    }
    return { owner: (conv?.ai_owner as string | null) ?? null, canSupervise };
  });

/** Devolve a conversa para o agente SDR ou passa para atendimento humano. */
export const setConversationAiOwner = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "update")])
  .inputValidator((input) => AiOwnerInput.extend({ owner: z.enum(["ai", "human"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertNotReadOnlyView } = await import("@/lib/view-as-guard.server");
    await assertNotReadOnlyView(supabase);
    const ws = await requireSdr(supabase, userId, "supervise");
    // Confirma via RLS do usuário que a conversa é visível e do workspace ativo.
    const { data: conv, error } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("id", data.conversation_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Conversa não encontrada neste workspace.");
    await assertSalesRecord(supabase, "whatsapp_conversations", conv.id, "update");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: rErr } = await supabaseAdmin.rpc("sdr_set_conversation_owner", {
      p_conversation: conv.id,
      p_owner: data.owner,
    });
    if (rErr) throw new Error("Não foi possível alterar quem atende a conversa.");
    return { owner: data.owner };
  });
