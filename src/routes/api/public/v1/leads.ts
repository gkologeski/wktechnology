import { emailSchema } from "@/lib/email-schema";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { buildMeta, jsonError, parseListParams } from "@/lib/api-keys/list-params.server";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";

import {
  humanPhone,
  isPhoneValidationError,
  phoneErrorBody,
  workspacePhoneCountry,
} from "@/lib/phone/phone-boundary";
const CreateLead = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().max(120).optional(),
  email: emailSchema().optional(),
  phone: z.string().max(64).optional(),
  job_title: z.string().max(2000).nullable().optional(),
  company_name: z.string().max(200).optional(),
  source: z.string().max(80).optional(),
});

export const Route = createFileRoute("/api/public/v1/leads")({
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
          .from("leads")
          .select(
            "id, first_name, last_name, email, phone, job_title, cargo_resumido, area_atuacao, nivel_hierarquico, company_name, status, source, created_at",
            { count: "exact" },
          )
          .eq("workspace_id", auth.workspaceId);

        const email = url.searchParams.get("email");
        if (email) query = query.ilike("email", email.trim());
        if (params.from) query = query.gte("created_at", params.from);
        if (params.to) query = query.lte("created_at", params.to);

        const { data, error, count } = await query
          .order("created_at", { ascending: params.ascending })
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
        const parsed = CreateLead.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "invalid_input", details: parsed.error.flatten() }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // Telefone: aceita formatado, grava E.164 (país padrão do workspace
        // para número sem +DDI). Inválido → 422 sem ecoar o número.
        try {
          const phone = humanPhone(parsed.data.phone ?? null, {
            field: "phone",
            country: await workspacePhoneCountry(supabaseAdmin, auth.workspaceId),
          });
          if (phone) parsed.data.phone = phone;
          else delete parsed.data.phone;
        } catch (e) {
          if (isPhoneValidationError(e)) return Response.json(phoneErrorBody(e), { status: 422 });
          throw e;
        }
        const dup = await checkLeadDuplicate(supabaseAdmin, {
          workspaceId: auth.workspaceId,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
        });
        if (dup.duplicate) {
          return new Response(JSON.stringify({ error: "duplicate", message: dup.message }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabaseAdmin
          .from("leads")
          .insert({
            owner_id: auth.ownerId,
            workspace_id: auth.workspaceId,
            assigned_to: auth.ownerId,
            status: "new",
            ...parsed.data,
          })

          .select(
            "id, first_name, last_name, email, phone, job_title, cargo_resumido, area_atuacao, nivel_hierarquico, company_name, status, source, created_at",
          )
          .single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        // Garante empresa e contato vinculados ao lead
        await ensureLeadRelationsSafe(supabaseAdmin, data.id);
        return Response.json({ data });
      },
    },
  },
});
