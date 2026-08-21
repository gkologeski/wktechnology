import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { buildMeta, jsonError, parseListParams } from "@/lib/api-keys/list-params.server";
import { MEETING_SELECT } from "@/lib/api-keys/meetings.server";

const CreateMeeting = z.object({
  title: z.string().min(1).max(255).default("Reunião"),
  scheduled_at: z.string().min(10).max(64),
  lead_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  recording_consent: z.boolean().optional(),
  assigned_to: z.string().uuid().optional(),
});

const SELECT = MEETING_SELECT;

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
        const params = parseListParams(url);
        let query = supabaseAdmin
          .from("meetings")
          .select(SELECT, { count: "exact" })
          .eq("workspace_id", auth.workspaceId);

        const leadId = url.searchParams.get("lead_id");
        if (leadId) query = query.eq("related_lead_id", leadId);
        const contactId = url.searchParams.get("contact_id");
        if (contactId) query = query.eq("related_contact_id", contactId);
        const dealId = url.searchParams.get("deal_id");
        if (dealId) query = query.eq("related_deal_id", dealId);
        const status = url.searchParams.get("status");
        if (status) query = query.eq("status", status);
        if (params.from) query = query.gte("scheduled_at", params.from);
        if (params.to) query = query.lte("scheduled_at", params.to);

        const { data, error, count } = await query
          .order("scheduled_at", { ascending: params.ascending, nullsFirst: false })
          .range(params.offset, params.offset + params.limit - 1);
        if (error) return jsonError(error.message, 400);

        const rows = data ?? [];
        return Response.json({ data: rows, meta: buildMeta(params, rows.length, count ?? null) });
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
            // meetings.owner_id referencia workspaces (não usuários).
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
        const { error: activityError } = await supabaseAdmin.from("activities").insert({
          owner_id: auth.ownerId,
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
        // A reunião já existe; a falha de timeline é registrada para diagnóstico.
        if (activityError)
          console.error(
            "[api/public/v1/meetings] falha ao registrar timeline:",
            activityError.message,
          );

        const origin = new URL(request.url).origin;
        return Response.json({
          data: { ...meeting, join_url: `${origin}/meet/${token}` },
        });
      },
    },
  },
});
