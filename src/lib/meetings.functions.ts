import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";
const supabaseAdmin = _supabaseAdmin as any;
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const ENTITY = z.enum(["contact", "lead", "deal", "ticket"]);
type Entity = z.infer<typeof ENTITY>;

const REL_COL: Record<Entity, string> = {
  contact: "related_contact_id",
  lead: "related_lead_id",
  deal: "related_deal_id",
  ticket: "related_ticket_id",
};

function randomToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, len);
}

function roomName(workspaceId: string): string {
  // Stable, unguessable, suitable for Jitsi public server
  return `wkt-${workspaceId.slice(0, 8)}-${randomToken(20)}`;
}

/* ============================================================
 * Create meeting (host action)
 * ============================================================ */
export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(255).default("Reunião"),
        entity: ENTITY.optional(),
        entity_id: z.string().uuid().optional(),
        scheduled_at: z.string().optional(),
        recording_consent: z.boolean().default(false),
        skip_activity: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const room = roomName(workspaceId);
    const token = randomToken(28);

    const insert: Record<string, unknown> = {
      owner_id: workspaceId,
      host_user_id: userId,
      title: data.title,
      room_name: room,
      public_token: token,
      provider: "jitsi",
      status: "scheduled",
      recording_consent: data.recording_consent,
      scheduled_at: data.scheduled_at ?? null,
    };
    if (data.entity && data.entity_id) {
      insert[REL_COL[data.entity]] = data.entity_id;
    }

    const { data: meeting, error } = await supabaseAdmin
      .from("meetings")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Log activity timeline entry (skip when the caller will record its own)
    if (!data.skip_activity) {
      const activity: Record<string, unknown> = {
        owner_id: workspaceId,
        workspace_id: workspaceId,
        created_by: userId,
        type: "meeting",
        subject: data.title,
        body: `Sala de vídeo criada (Jitsi). Link público: /meet/${token}`,
        external_ids: { meeting_id: meeting.id, provider: "jitsi", room_name: room },
      };
      if (data.entity && data.entity_id) {
        activity[REL_COL[data.entity]] = data.entity_id;
      }
      await supabaseAdmin.from("activities").insert(activity);
    }

    return { meeting };
  });

/* ============================================================
 * List meetings (library + entity panel)
 * ============================================================ */
export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: ENTITY.optional(),
        entity_id: z.string().uuid().optional(),
        search: z.string().optional(),
        status: z.enum(["all", "scheduled", "live", "ended", "cancelled"]).default("all"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    let q = supabaseAdmin
      .from("meetings")
      .select(
        "id, title, status, room_name, public_token, recording_storage_path, recording_duration_seconds, scheduled_at, started_at, ended_at, created_at, related_contact_id, related_lead_id, related_deal_id, related_ticket_id, host_user_id",
      )
      .eq("owner_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.entity && data.entity_id) q = q.eq(REL_COL[data.entity], data.entity_id);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: meetings, error } = await q;
    if (error) throw new Error(error.message);

    let filtered = meetings ?? [];

    if (data.search && data.search.trim()) {
      const term = data.search.toLowerCase();
      // Search title locally + transcript via meeting_summaries
      const { data: hits } = await supabaseAdmin
        .from("meeting_summaries")
        .select("meeting_id")
        .eq("owner_id", workspaceId)
        .textSearch("transcript_search", term, { type: "websearch" });
      const hitIds = new Set((hits ?? []).map((r: any) => r.meeting_id));
      filtered = filtered.filter(
        (m: any) => m.title?.toLowerCase().includes(term) || hitIds.has(m.id),
      );
    }
    return { meetings: filtered };
  });

/* ============================================================
 * Get one meeting (with summary) for the detail drawer
 * ============================================================ */
export const getMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: meeting, error } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!meeting) throw new Error("Reunião não encontrada");

    const { data: summary } = await supabaseAdmin
      .from("meeting_summaries")
      .select("*")
      .eq("meeting_id", meeting.id)
      .maybeSingle();
    const { data: participants } = await supabaseAdmin
      .from("meeting_participants")
      .select("id, display_name, email, joined_at, left_at")
      .eq("meeting_id", meeting.id)
      .order("joined_at", { ascending: true });

    let recordingUrl: string | null = null;
    if (meeting.recording_storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("meeting-recordings")
        .createSignedUrl(meeting.recording_storage_path, 60 * 60 * 24); // 24h
      recordingUrl = signed?.signedUrl ?? null;
    }
    return { meeting, summary, participants: participants ?? [], recordingUrl };
  });

/* ============================================================
 * End meeting
 * ============================================================ */
export const endMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("meetings")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * Delete meeting
 * ============================================================ */
export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    // delete recording from storage if present
    const { data: m } = await supabaseAdmin
      .from("meetings")
      .select("recording_storage_path")
      .eq("id", data.id)
      .eq("owner_id", workspaceId)
      .maybeSingle();
    if (m?.recording_storage_path) {
      await supabaseAdmin.storage.from("meeting-recordings").remove([m.recording_storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("meetings")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * Issue signed upload URL for recording
 * ============================================================ */
export const createRecordingUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        meeting_id: z.string().uuid(),
        filename: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: m, error: mErr } = await supabaseAdmin
      .from("meetings")
      .select("id, owner_id")
      .eq("id", data.meeting_id)
      .eq("owner_id", workspaceId)
      .maybeSingle();
    if (mErr || !m) throw new Error("Reunião não encontrada");

    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${workspaceId}/${m.id}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("meeting-recordings")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao criar URL de upload");
    return { uploadUrl: signed.signedUrl, token: signed.token, path };
  });

/* ============================================================
 * Mark recording uploaded (saves path on the meeting)
 * ============================================================ */
export const attachRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        meeting_id: z.string().uuid(),
        path: z.string().min(1).max(500),
        mime_type: z.string().min(1).max(120).optional(),
        duration_seconds: z.number().int().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("meetings")
      .update({
        recording_storage_path: data.path,
        recording_mime_type: data.mime_type ?? null,
        recording_duration_seconds: data.duration_seconds ?? null,
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.meeting_id)
      .eq("owner_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * AI: transcribe + summarize the uploaded recording
 *   Uses Lovable AI Gateway (Gemini 2.5 Flash for audio).
 * ============================================================ */
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const generateMeetingSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ meeting_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.meeting_id)
      .eq("owner_id", workspaceId)
      .maybeSingle();
    if (mErr || !meeting) throw new Error("Reunião não encontrada");
    if (!meeting.recording_storage_path) throw new Error("Sem gravação para transcrever");

    // upsert summary as processing
    await supabaseAdmin
      .from("meeting_summaries")
      .upsert(
        { meeting_id: meeting.id, owner_id: workspaceId, status: "processing" },
        { onConflict: "meeting_id" },
      );

    try {
      // 1) download audio from storage
      const { data: blob, error: dErr } = await supabaseAdmin.storage
        .from("meeting-recordings")
        .download(meeting.recording_storage_path);
      if (dErr || !blob) throw new Error(`Falha ao baixar gravação: ${dErr?.message}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const b64 = buf.toString("base64");
      const mime = meeting.recording_mime_type || "audio/mpeg";

      // 2) Ask Gemini for full transcript + structured summary
      const systemPrompt = `Você é um assistente que processa gravações de reuniões em português brasileiro.
Gere:
- transcript: transcrição literal completa (com timestamps aproximados quando possível, formato [mm:ss])
- summary: resumo executivo de até 6 linhas
- decisions: array de decisões tomadas (strings curtas)
- action_items: array de objetos { task: string, assignee: string|null, due_hint: string|null }
- sentiment: positive | neutral | negative
Responda APENAS com JSON válido.`;

      const res = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Processe esta gravação de reunião." },
                {
                  type: "input_audio",
                  input_audio: {
                    data: b64,
                    format: mime.includes("mp4")
                      ? "mp4"
                      : mime.includes("wav")
                        ? "wav"
                        : mime.includes("webm")
                          ? "webm"
                          : "mp3",
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 400)}`);
      }
      const json: any = await res.json();
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: any = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { summary: content, transcript: content, decisions: [], action_items: [] };
      }

      await supabaseAdmin
        .from("meeting_summaries")
        .update({
          status: "completed",
          transcript: parsed.transcript ?? null,
          summary: parsed.summary ?? null,
          decisions: parsed.decisions ?? [],
          action_items: parsed.action_items ?? [],
          sentiment: parsed.sentiment ?? null,
          model: "google/gemini-2.5-flash",
          error_message: null,
        })
        .eq("meeting_id", meeting.id);

      return { ok: true, action_items: parsed.action_items ?? [] };
    } catch (e: any) {
      await supabaseAdmin
        .from("meeting_summaries")
        .update({
          status: "failed",
          error_message: String(e?.message ?? e),
        })
        .eq("meeting_id", meeting.id);
      throw e;
    }
  });

/* ============================================================
 * Create tasks (activities type=task) from action items
 * ============================================================ */
export const createTasksFromActionItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ meeting_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.meeting_id)
      .eq("owner_id", workspaceId)
      .maybeSingle();
    if (!meeting) throw new Error("Reunião não encontrada");
    const { data: summary } = await supabaseAdmin
      .from("meeting_summaries")
      .select("action_items")
      .eq("meeting_id", meeting.id)
      .maybeSingle();

    const items = Array.isArray(summary?.action_items) ? (summary!.action_items as any[]) : [];
    if (!items.length) return { created: 0 };

    const due = new Date(Date.now() + 3 * 86400_000).toISOString();
    const rows = items.map((it) => {
      const base: Record<string, unknown> = {
        owner_id: workspaceId,
        workspace_id: workspaceId,
        created_by: context.userId,
        type: "task",
        subject: it?.task ?? "Tarefa da reunião",
        body: it?.assignee ? `Responsável sugerido: ${it.assignee}` : null,
        due_date: due,
        task_status: "open",
        task_priority: "medium",
        external_ids: { meeting_id: meeting.id, source: "meeting_action_item" },
      };
      if (meeting.related_contact_id) base.related_contact_id = meeting.related_contact_id;
      if (meeting.related_lead_id) base.related_lead_id = meeting.related_lead_id;
      if (meeting.related_deal_id) base.related_deal_id = meeting.related_deal_id;
      if (meeting.related_ticket_id) base.related_ticket_id = meeting.related_ticket_id;
      return base;
    });
    const { error } = await supabaseAdmin.from("activities").insert(rows);
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });

/* ============================================================
 * Workspace meeting settings
 * ============================================================ */
export const getMeetingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data } = await supabaseAdmin
      .from("workspaces")
      .select("meeting_settings")
      .eq("id", workspaceId)
      .maybeSingle();
    return { settings: (data?.meeting_settings as any) ?? {} };
  });

export const saveMeetingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        provider: z.enum(["jitsi"]).default("jitsi"),
        require_consent: z.boolean().default(true),
        retention_days: z.number().int().min(1).max(365).default(90),
        transcription_model: z.string().min(1).max(100).default("google/gemini-2.5-flash"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ meeting_settings: data })
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
