import { createFileRoute } from "@tanstack/react-router";
import { loadContractAcceptanceAttachment } from "@/lib/contracts/acceptance-attachment.server";

export const Route = createFileRoute(
  "/api/public/contract-acceptance/$token/attachments/$attachmentId",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const file = await loadContractAcceptanceAttachment(params.token, params.attachmentId);
          const name = file.fileName.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120) || "anexo";
          return new Response(file.bytes as BodyInit, {
            headers: {
              "Content-Type": file.contentType,
              "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
              "Cache-Control": "private, no-store",
              "Referrer-Policy": "no-referrer",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response("Anexo indisponível ou link de aceite inválido.", {
            status: 404,
            headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
          });
        }
      },
    },
  },
});
