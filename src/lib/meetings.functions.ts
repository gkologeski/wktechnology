import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

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
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    let q = supabaseAdmin
      .from("meetings")
      .select(
        "id, title, status, room_name, public_token, recording_storage_path, recording_duration_seconds, scheduled_at, started_at, ended_at, created_at, related_contact_id, related_lead_id, related_deal_id, related_ticket_id, host_user_id, assigned_to",
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
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: meeting, error } = await supabaseAdmin
      .from("meetings")
      .update({
        recording_storage_path: data.path,
        recording_mime_type: data.mime_type ?? null,
        recording_duration_seconds: data.duration_seconds ?? null,
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.meeting_id)
      .eq("owner_id", workspaceId)
      .select("id, title, related_deal_id, related_contact_id, related_lead_id, related_ticket_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Auto-publish the recording on the related entity's timeline.
    // Preference order: deal > contact > lead > ticket.
    if (meeting) {
      const targetCol =
        (meeting.related_deal_id && "related_deal_id") ||
        (meeting.related_contact_id && "related_contact_id") ||
        (meeting.related_lead_id && "related_lead_id") ||
        (meeting.related_ticket_id && "related_ticket_id") ||
        null;
      if (targetCol) {
        const filename = data.path.split("/").pop() || "gravacao";
        const attachments = [
          {
            path: data.path,
            name: filename,
            type: data.mime_type ?? "video/webm",
            size: 0,
            bucket: "meeting-recordings",
          },
        ];
        const activity: Record<string, unknown> = {
          owner_id: workspaceId,
          workspace_id: workspaceId,
          created_by: context.userId,
          type: "meeting",
          subject: `Gravação disponível: ${meeting.title ?? "Reunião"}`,
          body: `Gravação anexada automaticamente a partir da reunião.`,
          attachments,
          external_ids: { meeting_id: meeting.id, source: "meeting_recording" },
          [targetCol]: (meeting as any)[targetCol],
        };
        await supabaseAdmin.from("activities").insert(activity);
      }
    }
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
    const supabaseAdmin = await getSupabaseAdmin();
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
 * AI: summarize a Google Calendar event's Drive recording
 * ============================================================ */
async function refreshGoogleAccessToken(account: any): Promise<string> {
  const supabaseAdmin = await getSupabaseAdmin();
  if (!account.refresh_token)
    throw new Error("Conta de calendário sem refresh_token — reconecte o Google");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Credenciais OAuth do Google ausentes no servidor");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token Google: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      access_token: j.access_token,
      expires_at: expiresAt,
      last_status: "connected",
      last_error: null,
    })
    .eq("id", account.id);
  return j.access_token;
}

async function getGoogleAccessTokenForEvent(event: any): Promise<string> {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data: account } = await supabaseAdmin
    .from("calendar_accounts")
    .select("*")
    .eq("id", event.calendar_account_id)
    .maybeSingle();
  if (!account) throw new Error("Conta de calendário não encontrada");
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!account.access_token || Date.now() >= exp - 30_000) return refreshGoogleAccessToken(account);
  return account.access_token;
}

const MAX_RECORDING_BYTES = 80 * 1024 * 1024; // 80MB — limite ampliado p/ vídeo (worker tem ~128MB de memória)

/**
 * Procura no Google Drive um arquivo de TRANSCRIÇÃO do Meet relacionado ao evento.
 * Meet gera Google Doc (application/vnd.google-apps.document) ou .txt na mesma
 * pasta "Meet Recordings", com nome contendo o título da reunião + "Transcrição"/"Transcript".
 */
async function findDriveTranscript(
  token: string,
  ev: { title: string | null; end_at: string | null },
): Promise<{ file_id: string; mime_type: string } | null> {
  if (!ev.end_at) return null;
  const endMs = new Date(ev.end_at).getTime();
  if (!Number.isFinite(endMs)) return null;
  const after = new Date(endMs - 1 * 3600_000).toISOString();
  const before = new Date(endMs + 7 * 86400_000).toISOString();
  const baseTime = `createdTime > '${after}' and createdTime < '${before}' and trashed = false`;
  const titleFragment = (ev.title ?? "").trim().slice(0, 40).replace(/'/g, "\\'");

  // Meet transcript files: Google Doc or text/plain, com "Transcript"/"Transcrição" no nome
  const docMime = "(mimeType='application/vnd.google-apps.document' or mimeType='text/plain')";
  const nameMatches = titleFragment
    ? `(name contains '${titleFragment}' or name contains 'Transcrição' or name contains 'Transcript')`
    : `(name contains 'Transcrição' or name contains 'Transcript')`;
  const q = `${docMime} and ${nameMatches} and ${baseTime}`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime)&pageSize=20&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; createdTime?: string }[];
  };
  const files = json.files ?? [];
  // Priorizar arquivos cujo nome cite "Transcrição"/"Transcript"
  const ranked = files.sort((a, b) => {
    const score = (n: string) => (/transcri/i.test(n) ? 0 : 1);
    const sa = score(a.name);
    const sb = score(b.name);
    if (sa !== sb) return sa - sb;
    const da = Math.abs(new Date(a.createdTime ?? 0).getTime() - endMs);
    const db = Math.abs(new Date(b.createdTime ?? 0).getTime() - endMs);
    return da - db;
  });
  const pick = ranked[0];
  if (!pick) return null;
  return { file_id: pick.id, mime_type: pick.mimeType };
}

async function downloadDriveTextFile(token: string, fileId: string, mime: string): Promise<string> {
  const url =
    mime === "application/vnd.google-apps.document"
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao baixar transcrição (${res.status})`);
  return await res.text();
}

export const summarizeCalendarEventRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ calendar_event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: event, error: evErr } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", data.calendar_event_id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (evErr || !event) throw new Error("Evento de calendário não encontrado");
    if (!event.recording_drive_file_id)
      throw new Error("Este evento ainda não tem gravação vinculada no Drive");

    await supabaseAdmin
      .from("calendar_events")
      .update({ summary_status: "processing", summary_error: null })
      .eq("id", event.id);

    const systemPrompt = `Você é um assistente que processa reuniões em português brasileiro.
Gere:
- transcript: transcrição literal completa quando fornecida (caso contrário, derive do áudio com timestamps aproximados [mm:ss])
- summary: resumo executivo de até 6 linhas
- decisions: array de decisões tomadas (strings curtas)
- action_items: array de objetos { task: string, assignee: string|null, due_hint: string|null }
Responda APENAS com JSON válido.`;

    try {
      const token = await getGoogleAccessTokenForEvent(event);

      // 1) Tentar transcrição primeiro (texto, sem limite de tamanho prático)
      let userContent: any;
      let usedTranscript = false;
      const transcript = await findDriveTranscript(token, {
        title: event.title,
        end_at: event.end_at,
      });
      if (transcript) {
        const text = await downloadDriveTextFile(token, transcript.file_id, transcript.mime_type);
        const clipped = text.length > 200_000 ? text.slice(0, 200_000) : text;
        userContent = `Processe esta transcrição da reunião "${event.title ?? ""}".\n\n=== TRANSCRIÇÃO ===\n${clipped}`;
        usedTranscript = true;
      } else {
        // 2) Fallback: baixar o vídeo (com limite de 80MB)
        const fileId = event.recording_drive_file_id as string;
        const dres = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!dres.ok) {
          const t = await dres.text();
          throw new Error(`Falha ao baixar gravação do Drive (${dres.status}): ${t.slice(0, 200)}`);
        }
        const sizeHeader = Number(dres.headers.get("content-length") ?? "0");
        if (sizeHeader && sizeHeader > MAX_RECORDING_BYTES) {
          throw new Error(
            `Gravação tem ${(sizeHeader / 1024 / 1024).toFixed(0)}MB e excede o limite de ${Math.round(MAX_RECORDING_BYTES / 1024 / 1024)}MB para resumo automático a partir do vídeo. Ative a "Transcrição" no Google Meet durante a próxima reunião — assim conseguimos resumir reuniões de qualquer duração a partir do texto.`,
          );
        }
        const arrayBuf = await dres.arrayBuffer();
        if (arrayBuf.byteLength > MAX_RECORDING_BYTES) {
          throw new Error(
            `Gravação tem ${(arrayBuf.byteLength / 1024 / 1024).toFixed(0)}MB e excede o limite de ${Math.round(MAX_RECORDING_BYTES / 1024 / 1024)}MB. Ative a transcrição do Meet para reuniões longas.`,
          );
        }
        const b64 = Buffer.from(arrayBuf).toString("base64");
        const mime =
          (event.recording_mime_type as string | null) ??
          dres.headers.get("content-type") ??
          "video/mp4";
        const audioFormat = mime.includes("mp4")
          ? "mp4"
          : mime.includes("wav")
            ? "wav"
            : mime.includes("webm")
              ? "webm"
              : "mp3";
        userContent = [
          { type: "text", text: `Processe esta gravação da reunião "${event.title ?? ""}".` },
          { type: "input_audio", input_audio: { data: b64, format: audioFormat } },
        ];
      }

      const aiRes = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!aiRes.ok) {
        const txt = await aiRes.text();
        throw new Error(`AI gateway ${aiRes.status}: ${txt.slice(0, 400)}`);
      }
      const json: any = await aiRes.json();
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: any = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { summary: content, transcript: content };
      }

      const decisions: any[] = Array.isArray(parsed.decisions) ? parsed.decisions : [];
      const actionItems: any[] = Array.isArray(parsed.action_items) ? parsed.action_items : [];
      let summaryText: string = parsed.summary ?? "";
      if (usedTranscript)
        summaryText = `_Resumo gerado a partir da transcrição do Meet._\n\n${summaryText}`;
      if (decisions.length) {
        summaryText +=
          "\n\n**Decisões:**\n" +
          decisions.map((d) => `- ${typeof d === "string" ? d : JSON.stringify(d)}`).join("\n");
      }
      if (actionItems.length) {
        summaryText +=
          "\n\n**Próximos passos:**\n" +
          actionItems
            .map((it) => {
              const parts = [it?.task ?? ""];
              if (it?.assignee) parts.push(`(${it.assignee})`);
              if (it?.due_hint) parts.push(`— ${it.due_hint}`);
              return `- ${parts.join(" ")}`;
            })
            .join("\n");
      }

      await supabaseAdmin
        .from("calendar_events")
        .update({
          summary_status: "completed",
          summary_text: summaryText || null,
          transcript: parsed.transcript ?? null,
          summary_error: null,
          summary_generated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      return {
        ok: true,
        summary: summaryText,
        action_items: actionItems,
        source: usedTranscript ? "transcript" : "video",
      };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      await supabaseAdmin
        .from("calendar_events")
        .update({ summary_status: "failed", summary_error: msg.slice(0, 500) })
        .eq("id", event.id);
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
    const supabaseAdmin = await getSupabaseAdmin();
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
 * Sign a meeting recording URL (workspace-scoped)
 * ============================================================ */
export const signMeetingRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        path: z.string().min(1).max(500),
        expires_in: z.number().int().min(30).max(86400).default(3600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const workspaceId = await resolveActiveWorkspace(context.userId);
    // Path format: `${workspaceId}/${meetingId}/...`
    const firstSeg = data.path.split("/")[0];
    if (firstSeg !== workspaceId) throw new Error("Gravação não pertence ao workspace ativo");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("meeting-recordings")
      .createSignedUrl(data.path, data.expires_in);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL");
    return { url: signed.signedUrl };
  });

/* ============================================================
 * Workspace meeting settings
 * ============================================================ */
export const getMeetingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
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
    const supabaseAdmin = await getSupabaseAdmin();
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ meeting_settings: data })
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
