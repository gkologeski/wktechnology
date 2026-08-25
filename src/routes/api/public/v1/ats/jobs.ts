import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { badRequest, flagDisabled, isAtsPublicApiEnabled } from "@/lib/ats/public-api.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const SELECT =
  "id, title, slug, status, location, remote_mode, employment_type, seniority, salary_min, salary_max, salary_currency, opened_at, filled_at, created_at, updated_at";

const CreateJob = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(20000).optional(),
  requirements: z.string().max(20000).optional(),
  location: z.string().max(200).optional(),
  remote_mode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  employment_type: z
    .enum(["full_time", "part_time", "contract", "internship", "temporary"])
    .optional(),
  seniority: z.string().max(80).optional(),
  salary_min: z.number().int().nonnegative().optional(),
  salary_max: z.number().int().nonnegative().optional(),
  salary_currency: z.string().length(3).optional(),
  status: z.enum(["draft", "open", "paused", "closed"]).default("open"),
  pipeline_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/v1/ats/jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        if (!(await isAtsPublicApiEnabled(auth.ownerId))) return flagDisabled();
        const denied = requireScope(auth, "read");
        if (denied) return denied;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const status = url.searchParams.get("status");
        let q = supabaseAdmin
          .from("ats_jobs")
          .select(SELECT)
          .eq("owner_id", auth.ownerId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        return Response.json({ data: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        if (!(await isAtsPublicApiEnabled(auth.ownerId))) return flagDisabled();
        const denied = requireScope(auth, "write");
        if (denied) return denied;
        const body = await request.json().catch(() => null);
        const parsed = CreateJob.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.flatten());
        const workspaceId = await getActiveWorkspaceId(supabaseAdmin, auth.ownerId);
        const insertPayload = {
          owner_id: auth.ownerId,
          workspace_id: workspaceId,
          opened_at: parsed.data.status === "open" ? new Date().toISOString() : null,
          ...parsed.data,
        };
        const { data, error } = await supabaseAdmin
          .from("ats_jobs")
          .insert(insertPayload)
          .select(SELECT)
          .single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        if (data?.status === "open") {
          await recordAtsEvent(supabaseAdmin, {
            ownerId: auth.ownerId,
            name: "ats.job.posted",
            entityType: "job",
            entityId: data.id as string,
            payload: { source: "public_api", key_id: auth.keyId },
            dedupeKey: `ats.job.posted:${data.id}`,
          });
        }
        return Response.json({ data });
      },
    },
  },
});
