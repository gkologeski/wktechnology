import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import {
  buildMeta,
  jsonError,
  normalizeDateParam,
  parseListParams,
} from "@/lib/api-keys/list-params.server";

const DEAL_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const CreateDeal = z.object({
  name: z.string().min(1).max(255),
  value: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  stage_id: z.string().max(80).optional(),
  pipeline_id: z.string().uuid().optional(),
  expected_close_date: z.string().min(8).max(40).optional(),
  notes: z.string().max(5000).optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

const SELECT =
  "id, name, value, currency, stage, stage_id, pipeline_id, company_id, primary_contact_id, expected_close_date, closed_at, lost_at, assigned_to, created_at";

type PipelineStage = { value?: string; type?: string };

export const Route = createFileRoute("/api/public/v1/deals")({
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
          .from("deals")
          .select(SELECT, { count: "exact" })
          .eq("workspace_id", auth.workspaceId)
          .is("deleted_at", null);

        const stage = url.searchParams.get("stage");
        const stageParsed = z.enum(DEAL_STAGES).safeParse(stage ?? undefined);
        if (stage && !stageParsed.success)
          return jsonError("invalid_input", 400, {
            fieldErrors: { stage: ["Etapa inválida."] },
          });
        if (stageParsed.success) query = query.eq("stage", stageParsed.data);
        const pipelineId = url.searchParams.get("pipeline_id");
        if (pipelineId) query = query.eq("pipeline_id", pipelineId);
        const companyId = url.searchParams.get("company_id");
        if (companyId) query = query.eq("company_id", companyId);
        const contactId = url.searchParams.get("contact_id");
        if (contactId) query = query.eq("primary_contact_id", contactId);

        // Filtro por lead vinculado: usa o negócio convertido do lead.
        const leadId = url.searchParams.get("lead_id");
        if (leadId) {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("converted_deal_id")
            .eq("id", leadId)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!lead) return jsonError("lead_not_found", 404);
          query = query.eq("id", lead.converted_deal_id ?? "00000000-0000-0000-0000-000000000000");
        }

        if (params.from) query = query.gte("created_at", params.from);
        if (params.to) query = query.lte("created_at", params.to);

        const closedFrom = normalizeDateParam(url.searchParams.get("closed_from"));
        if (closedFrom) query = query.gte("closed_at", closedFrom);
        const closedTo = normalizeDateParam(url.searchParams.get("closed_to"), true);
        if (closedTo) query = query.lte("closed_at", closedTo);

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
        const parsed = CreateDeal.safeParse(body);
        if (!parsed.success) return jsonError("invalid_input", 400, parsed.error.flatten());
        const input = parsed.data;

        let companyId = input.company_id ?? null;
        let contactId = input.contact_id ?? null;

        if (companyId) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("id", companyId)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!company) return jsonError("company_not_found", 404);
        }
        if (contactId) {
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("id", contactId)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!contact) return jsonError("contact_not_found", 404);
        }

        // Lead vinculado: valida workspace e herda contato/empresa quando faltarem.
        let lead: {
          id: string;
          company_id: string | null;
          converted_contact_id: string | null;
        } | null = null;
        if (input.lead_id) {
          const { data: found } = await supabaseAdmin
            .from("leads")
            .select("id, company_id, converted_contact_id")
            .eq("id", input.lead_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!found) return jsonError("lead_not_found", 404);
          lead = found;
          companyId = companyId ?? found.company_id ?? null;
          contactId = contactId ?? found.converted_contact_id ?? null;
        }

        // Pipeline: usa o informado (validando workspace) ou o padrão de negócios.
        let pipelineId = input.pipeline_id ?? null;
        let stages: PipelineStage[] = [];
        if (pipelineId) {
          const { data: pipeline } = await supabaseAdmin
            .from("pipelines")
            .select("id, stages")
            .eq("id", pipelineId)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!pipeline) return jsonError("pipeline_not_found", 404);
          stages = (pipeline.stages as PipelineStage[] | null) ?? [];
        } else {
          const { data: pipeline } = await supabaseAdmin
            .from("pipelines")
            .select("id, stages")
            .eq("workspace_id", auth.workspaceId)
            .eq("entity", "deal")
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (pipeline) {
            pipelineId = pipeline.id;
            stages = (pipeline.stages as PipelineStage[] | null) ?? [];
          }
        }

        let stageId = input.stage_id ?? null;
        if (!stageId && stages.length) {
          const first = stages.find((s) => s.type !== "won" && s.type !== "lost") ?? stages[0];
          stageId = first?.value ?? null;
        }
        if (input.stage_id && stages.length && !stages.some((s) => s.value === input.stage_id)) {
          return jsonError("invalid_input", 400, {
            fieldErrors: { stage_id: ["Etapa não pertence ao pipeline informado."] },
          });
        }

        let expectedCloseDate: string | null = null;
        if (input.expected_close_date) {
          const parsedDate = new Date(input.expected_close_date);
          if (Number.isNaN(parsedDate.getTime()))
            return jsonError("invalid_input", 400, {
              fieldErrors: { expected_close_date: ["Data inválida (use ISO 8601)."] },
            });
          expectedCloseDate = parsedDate.toISOString().slice(0, 10);
        }

        const { data: deal, error } = await supabaseAdmin
          .from("deals")
          .insert({
            owner_id: auth.ownerId,
            workspace_id: auth.workspaceId,
            assigned_to: auth.ownerId,
            name: input.name,
            value: input.value ?? 0,
            currency: input.currency ?? "BRL",
            stage: input.stage ?? "new",
            stage_id: stageId,
            pipeline_id: pipelineId,
            company_id: companyId,
            primary_contact_id: contactId,
            expected_close_date: expectedCloseDate,
            notes: input.notes ?? null,
          })
          .select(SELECT)
          .single();
        if (error) return jsonError(error.message, 400);

        // Associa o contato ao negócio (aba de associações).
        if (contactId) {
          await supabaseAdmin
            .from("deal_contacts")
            .insert({ deal_id: deal.id, contact_id: contactId });
        }

        // Marca a conversão no lead de origem.
        if (lead) {
          await supabaseAdmin
            .from("leads")
            .update({
              converted_deal_id: deal.id,
              converted_at: new Date().toISOString(),
              ...(companyId ? { company_id: companyId } : {}),
              ...(contactId ? { converted_contact_id: contactId } : {}),
            })
            .eq("id", lead.id)
            .eq("workspace_id", auth.workspaceId);
        }

        // Registra na timeline do lead/contato/negócio.
        await supabaseAdmin.from("activities").insert({
          owner_id: auth.workspaceId,
          workspace_id: auth.workspaceId,
          created_by: auth.ownerId,
          assigned_to: auth.ownerId,
          type: "note",
          subject: `Negócio criado via API pública: ${deal.name}`,
          body: `Negócio "${deal.name}" criado pela API pública v1.`,
          related_lead_id: lead?.id ?? null,
          related_contact_id: contactId,
          related_deal_id: deal.id,
          related_company_id: companyId,
        });

        return Response.json({ data: deal });
      },
    },
  },
});
