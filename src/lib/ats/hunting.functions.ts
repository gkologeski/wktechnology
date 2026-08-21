/**
 * Hunting (LinkedIn) — captura de candidatos via extensão Chrome.
 *
 * Princípios:
 * - Toda captura é acionada por clique humano da recrutadora no DOM do
 *   LinkedIn que ela já está vendo. Sem scraping automatizado server-side.
 * - Dedupe por `linkedin_url` dentro do workspace.
 * - Templates de mensagem com variáveis substituídas no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

// ────────────────────────────────────────────────────────────────────────────
// Capturas
// ────────────────────────────────────────────────────────────────────────────

const CapturePayload = z.object({
  linkedin_url: z.string().url().max(500),
  full_name: z.string().min(1).max(200),
  headline: z.string().max(400).nullish(),
  location: z.string().max(200).nullish(),
  current_company: z.string().max(200).nullish(),
  current_position: z.string().max(200).nullish(),
  avatar_url: z.string().url().max(800).nullish(),
  about: z.string().max(4000).nullish(),
  source_url: z.string().url().max(500),
  parser_version: z.string().max(40).nullish(),
  session_id: z.string().max(80).nullish(),
  raw_payload: z.record(z.unknown()).optional(),
});

function normalizeLinkedinUrl(url: string): string {
  try {
    const u = new URL(url);
    // remove tracking + querystring; mantém path canônico /in/<slug>
    return `${u.origin}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export const captureCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CapturePayload.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const linkedinUrl = normalizeLinkedinUrl(data.linkedin_url);

    // 1. Dedupe por (owner_id, lower(linkedin_url))
    const { data: existing, error: findErr } = await supabase
      .from("ats_candidates")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("linkedin_url", linkedinUrl)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    let candidateId: string;
    let created = false;

    if (existing) {
      candidateId = existing.id as string;
      const patch: Record<string, unknown> = { last_touch_at: new Date().toISOString() };
      if (data.headline) patch.current_position = data.current_position ?? data.headline;
      if (data.current_company) patch.current_company = data.current_company;
      if (data.location) patch.location = data.location;
      const { error: upErr } = await supabase
        .from("ats_candidates")
        .update(patch as never)
        .eq("id", candidateId);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("ats_candidates")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          created_by: userId,
          full_name: data.full_name,
          linkedin_url: linkedinUrl,
          location: data.location ?? null,
          current_company: data.current_company ?? null,
          current_position: data.current_position ?? data.headline ?? null,
          source: "linkedin_hunter",
          last_touch_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      candidateId = ins.id as string;
      created = true;
      await recordAtsEvent(supabase, {
        ownerId: userId,
        name: "ats.candidate.sourced",
        entityType: "candidate",
        entityId: candidateId,
        payload: { source: "linkedin_hunter", source_url: data.source_url },
      });
    }

    // 2. Audit append-only
    await supabase.from("ats_hunting_captures").insert({
      owner_id: userId,
      workspace_id: workspaceId,
      candidate_id: candidateId,
      source_url: data.source_url,
      raw_payload: (data.raw_payload ?? {}) as never,
      parser_version: data.parser_version ?? null,
      session_id: data.session_id ?? null,
      captured_by: userId,
    } as never);

    return { candidate_id: candidateId, created };
  });

// ────────────────────────────────────────────────────────────────────────────
// Vinculações pós-captura
// ────────────────────────────────────────────────────────────────────────────

export const linkCaptureToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        job_id: z.string().uuid(),
        stage_value: z.string().max(60).default("applied"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // upsert manual: evita duplicar candidatura ativa para a mesma vaga
    const { data: dup } = await supabase
      .from("ats_applications")
      .select("id")
      .eq("job_id", data.job_id)
      .eq("candidate_id", data.candidate_id)
      .eq("status", "active")
      .maybeSingle();
    if (dup) return { application_id: dup.id as string, created: false };

    const { data: ins, error } = await supabase
      .from("ats_applications")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        job_id: data.job_id,
        candidate_id: data.candidate_id,
        stage_value: data.stage_value,
        status: "active",
        source: "linkedin_easy_apply",
        position: 0,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { application_id: ins.id as string, created: true };
  });

export const addCaptureToPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        pool_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_talent_pool_members")
      .upsert(
        [
          {
            pool_id: data.pool_id,
            candidate_id: data.candidate_id,
            owner_id: context.userId,
            added_by: context.userId,
            source: "manual",
          },
        ] as never,
        { onConflict: "pool_id,candidate_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enrollCaptureInSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        sequence_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_sourcing_enrollments")
      .upsert(
        [
          {
            sequence_id: data.sequence_id,
            candidate_id: data.candidate_id,
            owner_id: context.userId,
            status: "active",
            current_step: 0,
            next_run_at: new Date().toISOString(),
            started_by: context.userId,
          },
        ] as never,
        { onConflict: "sequence_id,candidate_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logOutreachSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        template_id: z.string().uuid().optional(),
        channel: z.enum(["linkedin_inmail", "linkedin_connect", "linkedin_message"]),
        body: z.string().min(1).max(8000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await supabase.from("activities").insert({
      owner_id: userId,
      workspace_id: workspaceId,
      type: "outreach",
      subject: `Mensagem ${data.channel.replace("linkedin_", "LinkedIn ")} enviada`,
      body: data.body,
      description: data.body,
    } as never);
    await supabase
      .from("ats_candidates")
      .update({ last_touch_at: new Date().toISOString() } as never)
      .eq("id", data.candidate_id);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Templates de mensagem
// ────────────────────────────────────────────────────────────────────────────

const TEMPLATE_CHANNEL = z.enum([
  "linkedin_inmail",
  "linkedin_connect",
  "linkedin_message",
]);

export const listHuntingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_hunting_templates")
      .select("id, name, channel, subject, body, variables, is_default, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertHuntingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        channel: TEMPLATE_CHANNEL,
        subject: z.string().max(200).nullish(),
        body: z.string().min(1).max(8000),
        is_default: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const payload = {
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      is_default: data.is_default ?? false,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("ats_hunting_templates")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_hunting_templates")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteHuntingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_hunting_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renderHuntingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        template_id: z.string().uuid(),
        candidate_id: z.string().uuid(),
        job_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: tpl }, { data: cand }, { data: job }] = await Promise.all([
      supabase
        .from("ats_hunting_templates")
        .select("subject, body, channel")
        .eq("id", data.template_id)
        .maybeSingle(),
      supabase
        .from("ats_candidates")
        .select("full_name, current_company, current_position, location")
        .eq("id", data.candidate_id)
        .maybeSingle(),
      data.job_id
        ? supabase.from("ats_jobs").select("title, location").eq("id", data.job_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!tpl) throw new Error("Template não encontrado");
    if (!cand) throw new Error("Candidato não encontrado");

    const firstName = (cand.full_name ?? "").split(/\s+/)[0] ?? "";
    const vars: Record<string, string> = {
      nome: cand.full_name ?? "",
      primeiro_nome: firstName,
      empresa_atual: (cand.current_company as string | null) ?? "",
      cargo_atual: (cand.current_position as string | null) ?? "",
      localizacao: (cand.location as string | null) ?? "",
      vaga: ((job as { title?: string } | null)?.title) ?? "",
      vaga_local: ((job as { location?: string } | null)?.location) ?? "",
    };
    const render = (s: string | null | undefined): string =>
      (s ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k: string) => vars[k.toLowerCase()] ?? "");

    return {
      channel: tpl.channel as string,
      subject: render(tpl.subject as string | null),
      body: render(tpl.body as string),
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// Listagens para UI
// ────────────────────────────────────────────────────────────────────────────

export const listRecentCaptures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ats_hunting_captures")
      .select("id, candidate_id, source_url, captured_at, parser_version")
      .order("captured_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.candidate_id as string)));
    let cands: Record<string, {
      id: string;
      full_name: string;
      current_company: string | null;
      current_position: string | null;
      linkedin_url: string | null;
    }> = {};
    if (ids.length) {
      const { data: c } = await supabase
        .from("ats_candidates")
        .select("id, full_name, current_company, current_position, linkedin_url")
        .in("id", ids);
      cands = Object.fromEntries(
        ((c ?? []) as Array<{
          id: string;
          full_name: string;
          current_company: string | null;
          current_position: string | null;
          linkedin_url: string | null;
        }>).map((x) => [x.id, x]),
      );
    }
    return {
      captures: (rows ?? []).map((r) => ({
        ...r,
        candidate: cands[r.candidate_id as string] ?? null,
      })),
    };
  });

export const listHuntingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const start7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [{ count: total }, { count: today }, { count: last7d }] = await Promise.all([
      supabase.from("ats_hunting_captures").select("id", { count: "exact", head: true }),
      supabase
        .from("ats_hunting_captures")
        .select("id", { count: "exact", head: true })
        .gte("captured_at", startOfDay.toISOString()),
      supabase
        .from("ats_hunting_captures")
        .select("id", { count: "exact", head: true })
        .gte("captured_at", start7d.toISOString()),
    ]);
    return {
      total: total ?? 0,
      today: today ?? 0,
      last_7_days: last7d ?? 0,
    };
  });
