import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createPublicBooking } from "@/lib/booking/engine.server";

const Body = z.object({
  start: z.string().min(10).max(64),
  invitee_name: z.string().min(1).max(200),
  invitee_email: z.string().email().max(255),
  invitee_phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
  hp: z.string().optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/public/booking/$slug/submit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request, params }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success)
          return Response.json(
            { error: "invalid_input", issues: parsed.error.issues },
            { status: 400, headers: corsHeaders },
          );
        if (parsed.data.hp) return Response.json({ ok: true }, { headers: corsHeaders }); // honeypot
        try {
          const out = await createPublicBooking({
            slug: params.slug,
            start: parsed.data.start,
            invitee_name: parsed.data.invitee_name,
            invitee_email: parsed.data.invitee_email,
            invitee_phone: parsed.data.invitee_phone ?? null,
            notes: parsed.data.notes ?? null,
            timezone: parsed.data.timezone ?? null,
          });
          return Response.json(
            { ok: true, id: out.id, meet_link: out.meet_link },
            { headers: corsHeaders },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
        }
      },
    },
  },
});
