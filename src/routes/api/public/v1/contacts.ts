import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { buildMeta, jsonError, parseListParams } from "@/lib/api-keys/list-params.server";

const CreateContact = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  job_title: z.string().max(160).optional(),
  company_name: z.string().max(200).optional(),
  company_id: z.string().uuid().optional(),
});

const SELECT =
  "id, first_name, last_name, email, phone, job_title, company_id, company_name, assigned_to, created_at";

export const Route = createFileRoute("/api/public/v1/contacts")({
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
          .from("contacts")
          .select(SELECT, { count: "exact" })
          .eq("workspace_id", auth.workspaceId)
          .is("deleted_at", null);

        const email = url.searchParams.get("email");
        if (email) query = query.ilike("email", email.trim());
        const companyId = url.searchParams.get("company_id");
        if (companyId) query = query.eq("company_id", companyId);
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
        const parsed = CreateContact.safeParse(body);
        if (!parsed.success) return jsonError("invalid_input", 400, parsed.error.flatten());
        const input = parsed.data;

        let companyId: string | null = null;
        if (input.company_id) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("id", input.company_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!company) return jsonError("company_not_found", 404);
          companyId = company.id;
        } else if (input.company_name?.trim()) {
          const name = input.company_name.trim();
          const { data: existing } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("workspace_id", auth.workspaceId)
            .ilike("name", name)
            .limit(1)
            .maybeSingle();
          if (existing?.id) {
            companyId = existing.id;
          } else {
            const { data: created, error: companyError } = await supabaseAdmin
              .from("companies")
              .insert({
                owner_id: auth.ownerId,
                workspace_id: auth.workspaceId,
                assigned_to: auth.ownerId,
                name,
              })
              .select("id")
              .single();
            if (companyError) return jsonError(companyError.message, 400);
            companyId = created.id;
          }
        }

        const { data, error } = await supabaseAdmin
          .from("contacts")
          .insert({
            owner_id: auth.ownerId,
            workspace_id: auth.workspaceId,
            assigned_to: auth.ownerId,
            first_name: input.first_name,
            last_name: input.last_name ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            job_title: input.job_title ?? null,
            company_name: input.company_name ?? null,
            company_id: companyId,
          })
          .select(SELECT)
          .single();
        if (error) return jsonError(error.message, 400);
        return Response.json({ data });
      },
    },
  },
});
