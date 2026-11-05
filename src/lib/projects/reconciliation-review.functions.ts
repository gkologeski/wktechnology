import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireReconAdmin } from "./reconciliation.server";

const row = z.object({
  id: z.string().uuid(),
  kind: z.enum(["company", "time"]),
  label: z.string(),
  token: z.string(),
  before: z.record(z.string(), z.string().uuid().nullable()),
  after: z.record(z.string(), z.string().uuid().nullable()),
});
export type ReviewedLink = z.infer<typeof row>;
export type ReviewPage = { rows: ReviewedLink[]; cursor: string | null; review_note: string };
export const previewReviewedLinks = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.reconciliation", "view")])
  .inputValidator((value: unknown) =>
    z
      .object({
        kind: z.enum(["company", "time"]),
        from: z.string().date(),
        to: z.string().date(),
        cursor: z.string().uuid().nullable(),
      })
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return workRpc<ReviewPage>(context.supabase, "project_link_review_preview", {
      w: ctx.workspaceId,
      k: data.kind,
      d1: data.from,
      d2: data.to,
      cursor_id: data.cursor,
    });
  });
export const applyReviewedLinks = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.reconciliation", "manage")])
  .inputValidator((value: unknown) =>
    z.object({ batch: z.string().uuid(), rows: z.array(row).min(1).max(100) }).parse(value),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return workRpc<{ changed: number }>(context.supabase, "project_link_review_apply", {
      w: ctx.workspaceId,
      batch: data.batch,
      reviewed: data.rows,
    });
  });
export const revertReviewedLinks = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.reconciliation", "manage")])
  .inputValidator((value: unknown) => z.object({ batch: z.string().uuid() }).parse(value))
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return workRpc<{ reverted: number; skipped_changed_since: number }>(
      context.supabase,
      "project_link_review_revert",
      {
        w: ctx.workspaceId,
        batch: data.batch,
      },
    );
  });

export const historyReviewedLinks = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.reconciliation", "view")])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return workRpc<Array<{ id: string; created_at: string; changed: number; reversible: boolean }>>(
      context.supabase,
      "project_link_review_history",
      { w: ctx.workspaceId },
    );
  });
