// TechProjects — envio de apontamentos guardados no aparelho (fila offline opt-in).
// O servidor revalida TUDO no envio, como o usuário (RLS): membership ativo, workspace ativo igual
// ao do pedido, vínculo/vigência no projeto, sobreposição, competência fechada e "Ver como".
// Mesmo pedido repetido devolve o resultado gravado; mesmo id com conteúdo diferente é conflito.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

/** Usuário e workspace ativos: a fila do aparelho só envia itens deste par. */
export const getOfflineContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    userId: context.userId,
    workspaceId: await resolveActiveWorkspace(context.userId),
  }));

export const syncOfflineTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        clientRequestId: z.string().uuid(),
        requestHash: z.string().regex(/^[0-9a-f]{64}$/),
        deviceRecordedAt: z.string().datetime().nullable().optional(),
        payload: z
          .object({
            project_id: z.string().uuid(),
            task_id: z.string().uuid(),
            entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            mode: z.enum(["interval", "duration"]),
            start_time: z
              .string()
              .regex(/^\d{2}:\d{2}(:\d{2})?$/)
              .optional(),
            end_time: z
              .string()
              .regex(/^\d{2}:\d{2}(:\d{2})?$/)
              .optional(),
            duration_seconds: z.number().int().min(60).max(86400).optional(),
            timezone: z.string().max(64).optional(),
            description: z.string().max(2000).optional(),
            billable: z.boolean().optional(),
          })
          .strict(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Item de outra conta nunca é enviado nesta sessão (o aparelho pode ser compartilhado).
    if (data.userId !== context.userId)
      throw new Error("OFFLINE_OTHER_ACCOUNT: este apontamento foi guardado por outra conta.");
    const { canonicalJson, sha256Hex } = await import("./public-api.shared");
    if ((await sha256Hex(canonicalJson(data.payload))) !== data.requestHash)
      throw new Error("OFFLINE_REQUEST_CONFLICT: conteúdo diferente do guardado no aparelho.");
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: res, error } = await rpc("project_time_entry_sync", {
      p_ws: data.workspaceId,
      p_client_request_id: data.clientRequestId,
      p_request_hash: data.requestHash,
      p_payload: data.payload,
      p_device_recorded_at: data.deviceRecordedAt ?? null,
    });
    if (error) throw new Error(error.message);
    const r = res as { replay: boolean; entry: Record<string, unknown> | null };
    if (!r.replay && r.entry) {
      const { enqueueProjectEvent } = await import("@/lib/webhooks/dispatcher.server");
      const { projectEventPayload } = await import("./public-api.server");
      await enqueueProjectEvent(
        data.workspaceId,
        "project.time_entry.created",
        projectEventPayload(r.entry),
      );
    }
    return {
      replay: r.replay,
      entryId: (r.entry?.id as string | undefined) ?? null,
      status: (r.entry?.status as string | undefined) ?? null,
    };
  });
