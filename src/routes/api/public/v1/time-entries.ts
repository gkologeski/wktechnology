// API pública v1 — apontamentos de horas do TechProjects.
// Autenticada por API key (`api_keys`), escopo `read` para GET e `write` para POST.
// Idempotência: `external_id` é único por workspace; um POST repetido devolve o registro existente.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { buildMeta, jsonError, parseListParams } from "@/lib/api-keys/list-params.server";

const SELECT =
  "id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_minutes, description, billable, status, source, external_id, created_at";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}(:\d{2})?$/;

const CreateEntry = z
  .object({
    project_id: z.string().uuid(),
    task_id: z.string().uuid().nullish(),
    entry_date: z.string().regex(DATE_ONLY),
    start_time: z.string().regex(CLOCK).nullish(),
    end_time: z.string().regex(CLOCK).nullish(),
    duration_minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional(),
    description: z.string().max(2000).nullish(),
    billable: z.boolean().optional(),
    external_id: z.string().min(1).max(180).optional(),
  })
  .refine((v) => v.duration_minutes != null || (v.start_time != null && v.end_time != null), {
    message: "Informe duration_minutes ou start_time e end_time.",
  });

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
}

export const Route = createFileRoute("/api/public/v1/time-entries")({
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
          .from("project_time_entries")
          .select(SELECT, { count: "exact" })
          .eq("workspace_id", auth.workspaceId);

        const projectId = url.searchParams.get("project_id");
        if (projectId) query = query.eq("project_id", projectId);
        const userId = url.searchParams.get("user_id");
        if (userId) query = query.eq("user_id", userId);
        const status = url.searchParams.get("status");
        if (status) query = query.eq("status", status);
        const from = url.searchParams.get("from");
        if (from && DATE_ONLY.test(from)) query = query.gte("entry_date", from);
        const to = url.searchParams.get("to");
        if (to && DATE_ONLY.test(to)) query = query.lte("entry_date", to);

        const { data, error, count } = await query
          .order("entry_date", { ascending: params.ascending, nullsFirst: false })
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
        const parsed = CreateEntry.safeParse(body);
        if (!parsed.success)
          return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
        const input = parsed.data;

        // Idempotência por external_id dentro do workspace.
        if (input.external_id) {
          const { data: existing } = await supabaseAdmin
            .from("project_time_entries")
            .select(SELECT)
            .eq("workspace_id", auth.workspaceId)
            .eq("external_id", input.external_id)
            .maybeSingle();
          if (existing) return Response.json({ data: existing, idempotent: true });
        }

        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("id", input.project_id)
          .eq("workspace_id", auth.workspaceId)
          .maybeSingle();
        if (!project) return json({ error: "project_not_found" }, 404);

        if (input.task_id) {
          const { data: task } = await supabaseAdmin
            .from("project_tasks")
            .select("id")
            .eq("id", input.task_id)
            .eq("project_id", input.project_id)
            .eq("workspace_id", auth.workspaceId)
            .maybeSingle();
          if (!task) return json({ error: "task_not_found" }, 404);
        }

        const duration =
          input.duration_minutes ??
          minutesBetween(input.start_time as string, input.end_time as string);
        if (!Number.isFinite(duration) || duration <= 0)
          return json(
            { error: "invalid_input", details: { duration_minutes: ["Duração inválida."] } },
            400,
          );

        const { data: created, error } = await supabaseAdmin
          .from("project_time_entries")
          .insert({
            workspace_id: auth.workspaceId,
            project_id: input.project_id,
            task_id: input.task_id ?? null,
            user_id: auth.ownerId,
            created_by: auth.ownerId,
            entry_date: input.entry_date,
            start_time: input.start_time ?? null,
            end_time: input.end_time ?? null,
            duration_minutes: duration,
            hours: Number((duration / 60).toFixed(2)),
            description: input.description ?? null,
            billable: input.billable ?? true,
            status: "draft",
            source: "api",
            external_id: input.external_id ?? null,
          })
          .select(SELECT)
          .single();
        if (error) return jsonError(error.message, 400);

        return Response.json({ data: created }, { status: 201 });
      },
    },
  },
});
