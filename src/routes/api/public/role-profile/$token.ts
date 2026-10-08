// Link seguro do cliente para complementar/validar um perfil de vaga.
// Autoriza pelo token (hash no banco, expiração, revogação, limites). Nunca serializa comercial interno.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z
  .object({
    changes: z.record(z.string().max(80), z.unknown()).default({}),
    confirm: z.boolean().default(false),
    attachment: z
      .object({ filename: z.string().min(1).max(255), base64: z.string().min(8).max(14_500_000) })
      .optional(),
  })
  .strict();

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });

export const Route = createFileRoute("/api/public/role-profile/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { publicView, LinkError } = await import("@/lib/role-profiles/public-link.server");
        try {
          return json(await publicView(params.token));
        } catch (e) {
          return json({ error: (e as Error).message }, e instanceof LinkError ? e.status : 500);
        }
      },
      POST: async ({ params, request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Requisição inválida." }, 400);
        const { publicSubmit, LinkError } = await import("@/lib/role-profiles/public-link.server");
        try {
          return json(await publicSubmit(params.token, parsed.data));
        } catch (e) {
          return json({ error: (e as Error).message }, e instanceof LinkError ? e.status : 500);
        }
      },
    },
  },
});
