import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";

const CreateMeeting = z.object({
  title: z.string().min(1).max(255).default("Reunião"),
  scheduled_at: z.string().min(10).max(64),
  lead_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  recording_consent: z.boolean().optional(),
  assigned_to: z.string().uuid().optional(),
});

const SELECT =
  "id, title, status, scheduled_at, public_token, room_name, related_lead_id, related_contact_id, related_deal_id, assigned_to, created_at";

function randomToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, len);
}

function invalid(details: unknown) {
  return new Response(JSON.stringify({ error: "invalid_input", details }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/v1/meetings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "read");
        if (denied) return denied;

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
        let query = supabaseAdmin
          .from("meetings")
          .select(SELECT)
          .eq("owner_id", auth.workspaceId)
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(limit);

        const leadId = url.searchParams.get("lead_id");
        if (leadId) query = query.eq("related_lead_id", leadId);
        const from = url.searchParams.get("from");
        if (from) query = query.gte("scheduled_at", from);
        const to = url.searchParams.get("to");
        if (to) query = query.lte("scheduled_at", to);

        const { data, error } = await query;
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        return Response.json({ data: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = CreateMeeting.safeParse(body);
        if (!parsed.success) return invalid(parsed.error.flatten());
        const input = parsed.data;

        const scheduledAt = new Date(input.scheduled_at);
        if (Number.isNaN(scheduledAt.getTime()))
          return invalid({ scheduled_at: ["Data inválida (use ISO 8601)."] });

        // Garante que a entidade vinculada pertence ao workspace da chave
        if (input.lead_id) {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("id", input.lead_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!lead)
            return new Response(JSON.stringify({ error: "lead_not_found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
        }
        if (input.contact_id) {
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("id", input.contact_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!contact)
            return new Response(JSON.stringify({ error: "contact_not_found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
        }
        if (input.deal_id) {
          const { data: deal } = await supabaseAdmin
            .from("deals")
            .select("id")
            .eq("id", input.deal_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!deal)
            return new Response(JSON.stringify({ error: "deal_not_found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
        }

        const token = randomToken(28);
        const room = `wkt-${auth.workspaceId.slice(0, 8)}-${randomToken(20)}`;

        const { data: meeting, error } = await supabaseAdmin
          .from("meetings")
          .insert({
            owner_id: auth.workspaceId,
            workspace_id: auth.workspaceId,
            host_user_id: auth.ownerId,
            title: input.title,
            provider: "jitsi",
            status: "scheduled",
            room_name: room,
            public_token: token,
            recording_consent: input.recording_consent ?? false,
            scheduled_at: scheduledAt.toISOString(),
            related_lead_id: input.lead_id ?? null,
            related_contact_id: input.contact_id ?? null,
            related_deal_id: input.deal_id ?? null,
            assigned_to: input.assigned_to ?? auth.ownerId,
          })
          .select(SELECT)
          .single();
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });

        // Registra a reunião na timeline da entidade vinculada
        await supabaseAdmin.from("activities").insert({
          owner_id: auth.workspaceId,
          workspace_id: auth.workspaceId,
          created_by: auth.ownerId,
          assigned_to: input.assigned_to ?? auth.ownerId,
          type: "meeting",
          subject: input.title,
          body: `Reunião agendada via API pública. Link público: /meet/${token}`,
          due_date: scheduledAt.toISOString(),
          related_lead_id: input.lead_id ?? null,
          related_contact_id: input.contact_id ?? null,
          related_deal_id: input.deal_id ?? null,
          external_ids: { meeting_id: meeting.id, provider: "jitsi", room_name: room },
        });

        const origin = new URL(request.url).origin;
        return Response.json({
          data: { ...meeting, join_url: `${origin}/meet/${token}` },
        });
      },
    },
  },
});
