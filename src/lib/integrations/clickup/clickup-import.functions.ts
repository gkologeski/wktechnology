// Server functions do importador ClickUp (finas: validação + delegação ao serviço).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClickUpImport } from "./clickup-import.middleware";

const uuid = z.string().uuid();
const cursorSchema = z.object({
  lists: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)).max(5000),
  index: z.number().int().min(0),
  page: z.number().int().min(0).max(10000),
  counts: z.record(z.string(), z.object({ tasks: z.number().int(), closed: z.number().int() })),
  people: z.record(
    z.string(),
    z.object({
      username: z.string().max(300).nullable(),
      email: z.string().max(320).nullable(),
      tasks: z.number().int(),
    }),
  ),
});

export const getClickUpImportStatus = createServerFn({ method: "GET" })
  .middleware([requireClickUpImport("view")])
  .handler(async ({ context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.getStatus({ client: context.supabase, workspaceId, userId: context.userId });
  });

export const getClickUpImportTargets = createServerFn({ method: "GET" })
  .middleware([requireClickUpImport("view")])
  .handler(async ({ context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.listTargets({ client: context.supabase, workspaceId, userId: context.userId });
  });

export const startClickUpCollect = createServerFn({ method: "POST" })
  .middleware([requireClickUpImport("manage")])
  .handler(async ({ context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.startCollect({ client: context.supabase, workspaceId, userId: context.userId });
  });

export const stepClickUpCollect = createServerFn({ method: "POST" })
  .middleware([requireClickUpImport("manage")])
  .inputValidator((d) => z.object({ runId: uuid, cursor: cursorSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    const ctx = { client: context.supabase, workspaceId, userId: context.userId };
    const r = await s.collectStep(ctx, data.runId, data.cursor);
    if (r.done) await s.finishCollect(ctx, data.runId, r.cursor);
    return r;
  });

export const setClickUpGroup = createServerFn({ method: "POST" })
  .middleware([requireClickUpImport("manage")])
  .inputValidator((d) =>
    z
      .object({
        groupId: uuid,
        action: z.enum(["import", "skip"]),
        spaceId: uuid.nullable(),
        newSpace: z.string().max(120).nullable(),
        projectId: uuid.nullable(),
        newProject: z.string().max(200).nullable(),
        listName: z.string().max(120).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.setGroup({ client: context.supabase, workspaceId, userId: context.userId }, data);
  });

export const setClickUpPerson = createServerFn({ method: "POST" })
  .middleware([requireClickUpImport("manage")])
  .inputValidator((d) =>
    z
      .object({
        clickupUserId: z.number().int().positive(),
        userId: uuid.nullable(),
        status: z.enum(["confirmed", "ignored", "unmatched"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.setPerson({ client: context.supabase, workspaceId, userId: context.userId }, data);
  });

export const runClickUpImportStep = createServerFn({ method: "POST" })
  .middleware([requireClickUpImport("manage")])
  .inputValidator((d) =>
    z.object({ runId: uuid, kind: z.enum(["apply", "assignees", "rollback"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clickup-import.server");
    const workspaceId = context.clickupWorkspaceId;
    return s.runStep(
      { client: context.supabase, workspaceId, userId: context.userId },
      data.kind,
      data.runId,
    );
  });
