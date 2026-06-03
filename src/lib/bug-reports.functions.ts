// Server functions for the platform-admin bug reports inbox.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STATUSES = ["open", "triaged", "in_progress", "resolved", "wont_fix"] as const;
export type BugReportStatus = (typeof STATUSES)[number];

async function assertPlatformAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: apenas super-admins da plataforma.");
}

export const listBugReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum([...STATUSES, "all", "unresolved"]).optional(),
        kind: z.enum(["new_feature", "existing_broken", "all"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.userId);

    let q = supabaseAdmin
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status === "unresolved") {
      q = q.in("status", ["open", "triaged", "in_progress"]);
    } else if (data.status && data.status !== "all") {
      q = q.eq("status", data.status);
    }
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const reporterIds = Array.from(new Set((rows ?? []).map((r) => r.owner_id as string)));
    const reporters: Record<string, { email: string | null; full_name: string | null }> = {};
    if (reporterIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds);
      for (const p of profs ?? []) {
        reporters[p.id as string] = { email: null, full_name: (p.full_name as string) ?? null };
      }
      await Promise.all(
        reporterIds.map(async (id) => {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
            if (u?.user) {
              reporters[id] = {
                email: u.user.email ?? null,
                full_name: reporters[id]?.full_name ?? null,
              };
            }
          } catch {
            /* ignore */
          }
        }),
      );
    }

    return (rows ?? []).map((r) => ({
      ...r,
      reporter: reporters[r.owner_id as string] ?? { email: null, full_name: null },
    }));
  });

export const updateBugReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("bug_reports")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBugReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.userId);

    const { data: row } = await supabaseAdmin
      .from("bug_reports")
      .select("recording_path")
      .eq("id", data.id)
      .maybeSingle();

    if (row?.recording_path) {
      await supabaseAdmin.storage.from("bug-reports").remove([row.recording_path as string]);
    }

    const { error } = await supabaseAdmin.from("bug_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBugReportRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("bug-reports")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const BUG_REPORT_STATUSES = STATUSES;
