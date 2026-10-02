// Conversão de contrato em modelo com resposta em fluxo (NDJSON).
// Envia "ping" periódico enquanto a IA trabalha, evitando que a conexão caia
// ("Failed to fetch") em documentos longos; ao fim envia o resultado.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  kind: z.enum(["pdf", "html"]),
  base64: z.string().min(20).max(30_000_000).optional(),
  html: z.string().min(40).max(400_000).optional(),
});

export const Route = createFileRoute("/api/contracts/template-import")({
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
        const data = parsed.data;
        if (data.kind === "pdf" && !data.base64) return new Response("Arquivo ausente", { status: 400 });
        if (data.kind === "html" && !data.html) return new Response("Conteúdo ausente", { status: 400 });

        const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
        const { assertAnyPermission } = await import("@/lib/access-control/enforce.server");
        const { convertTemplateWithAi, TEMPLATE_IMPORT_PERMISSIONS } = await import(
          "@/lib/contracts/template-import.server"
        );
        let workspaceId: string;
        try {
          workspaceId = await resolveActiveWorkspace(userId);
          await assertAnyPermission(supabase, userId, workspaceId, TEMPLATE_IMPORT_PERMISSIONS);
        } catch (e) {
          return new Response((e as Error).message || "Sem permissão", { status: 403 });
        }

        const content =
          data.kind === "pdf"
            ? [
                { type: "text", text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras.` },
                { type: "file", file: { filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` } },
              ]
            : [
                { type: "text", text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras. Conteúdo em HTML:\n\n${data.html}` },
              ];

        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            const ping = setInterval(() => send({ type: "ping" }), 8000);
            try {
              send({ type: "ping" });
              const result = await convertTemplateWithAi(content, { userId, workspaceId });
              send({ type: "result", result });
            } catch (e) {
              send({ type: "error", message: (e as Error).message || "Falha na conversão" });
            } finally {
              clearInterval(ping);
              controller.close();
            }
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
