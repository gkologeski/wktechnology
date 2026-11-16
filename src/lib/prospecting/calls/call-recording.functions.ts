// VOZ-AUDIO-FILA: entrega um link reproduzível da gravação de uma ligação.
// A tentativa é lida com o cliente do usuário (RLS de prospecting_call_attempts):
// quem não enxerga a ligação não recebe o áudio.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const getCallRecordingPlayUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ attempt_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase
      .from("prospecting_call_attempts")
      .select("vapi_call_id, recording_url")
      .eq("id", data.attempt_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.recording_url) return { url: null };
    // Gravações Vapi ficam em bucket privado: só tocam pelo link assinado da API.
    if (!row.vapi_call_id || !/r2\.cloudflarestorage\.com/i.test(row.recording_url)) {
      return { url: row.recording_url };
    }
    const apiKey = process.env["VAPI_API_KEY"];
    if (!apiKey) throw new Error("Integração de voz não configurada.");
    const res = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(row.vapi_call_id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Não foi possível obter a gravação (${res.status}).`);
    const call = (await res.json()) as { artifact?: { presignedMonoUrl?: string } };
    return { url: call.artifact?.presignedMonoUrl ?? null };
  });
