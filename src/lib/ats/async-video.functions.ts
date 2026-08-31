// Server functions para vídeo assíncrono do ATS.
// Recrutador: lista respostas + gera URL assinada para reprodução.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteWhereGuarded } from "@/lib/db/delete-guarded";

const BUCKET = "ats-async-videos";

export const listAsyncVideoResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interview_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("ats_async_video_responses")
      .select("id, question_id, storage_path, duration_sec, mime_type, size_bytes, created_at")
      .eq("workspace_id", workspaceId)
      .eq("interview_id", data.interview_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // gera signed URLs (5 min)
    const out = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(r.storage_path, 300);
        return { ...r, signed_url: signed?.signedUrl ?? null };
      }),
    );
    return out;
  });

export const deleteAsyncVideoResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error: rErr } = await supabase
      .from("ats_async_video_responses")
      .select("id, storage_path")
      .eq("workspace_id", workspaceId)
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Resposta não encontrada");
    await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
    await deleteWhereGuarded(
      supabase,
      "ats_async_video_responses",
      { id: data.id, workspace_id: workspaceId },
      "Você não tem permissão para excluir esta resposta de vídeo.",
    );
    return { ok: true };
  });
