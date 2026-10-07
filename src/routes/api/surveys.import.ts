// Importar pesquisa com IA (NDJSON com progresso). Autenticado; workspace do usuário.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.union([
  z.object({ kind: z.literal("url"), url: z.string().min(8).max(2000) }),
  z.object({
    kind: z.literal("file"),
    filename: z.string().min(1).max(255),
    base64: z.string().min(20).max(14_500_000),
  }),
]);

export const Route = createFileRoute("/api/surveys/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const url = process.env["SUPABASE_URL"];
        const pk = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !pk) return new Response("Configuração ausente", { status: 500 });
        const supabase = createClient<Database>(url, pk, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (authErr || !userId) return new Response("Unauthorized", { status: 401 });
        const parsed = BodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Requisição inválida", { status: 400 });

        const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
        const { runSurveyImport } = await import("@/lib/surveys/import/import.server");
        let workspaceId: string;
        try {
          workspaceId = await resolveActiveWorkspace(userId);
        } catch (e) {
          return new Response((e as Error).message || "Sem workspace", { status: 403 });
        }

        const enc = new TextEncoder();
        const abort = new AbortController();
        request.signal.addEventListener("abort", () => abort.abort());
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => {
              try {
                controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
              } catch {
                /* cliente saiu */
              }
            };
            const ping = setInterval(() => send({ type: "ping" }), 8000);
            try {
              const result = await runSurveyImport(
                parsed.data,
                { userId, workspaceId, supabase },
                send,
                abort.signal,
              );
              send({ type: "result", result });
            } catch (e) {
              send({
                type: "error",
                message: abort.signal.aborted
                  ? "Importação cancelada."
                  : (e as Error).message || "Falha na importação",
              });
            } finally {
              clearInterval(ping);
              try {
                controller.close();
              } catch {
                /* já fechado */
              }
            }
          },
          cancel() {
            abort.abort();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
