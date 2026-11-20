import { z } from "zod";
import { NOTIFICATION_CATEGORIES, withNotificationEvent } from "./notification-catalog";

export const notificationCenterCursorSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
  })
  .strict();
export const notificationCenterQuerySchema = z
  .object({
    workspaceId: z.string().uuid(),
    scope: z.enum(["workspace", "legacy"]).default("workspace"),
    status: z.enum(["all", "unread", "read", "snoozed"]).default("all"),
    category: z.enum(NOTIFICATION_CATEGORIES.map((c) => c.key) as [string, ...string[]]).nullish(),
    module: z.enum(["crm", "ats", "people", "contracts", "finance", "projects"]).nullish(),
    q: z.string().trim().max(120).default(""),
    cursor: notificationCenterCursorSchema.nullish(),
    cutoff: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
export type NotificationCenterQuery = z.input<typeof notificationCenterQuerySchema>;

const rawItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  eventKey: z.string().max(100).nullable().optional(),
  moduleKey: z
    .enum(["crm", "ats", "people", "contracts", "finance", "projects"])
    .nullable()
    .default(null),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  entity: z.string().nullable(),
  entity_id: z.string().uuid().nullable(),
  created_at: z.string().datetime({ offset: true }),
  read_at: z.string().datetime({ offset: true }).nullable(),
  snoozed_until: z.string().datetime({ offset: true }).nullable(),
});
export const notificationCenterBadgeSchema = z.object({
  unread: z.number().int().min(0).max(100),
  unreadCapped: z.boolean(),
  checkedAt: z.string().datetime({ offset: true }),
});
export const notificationCenterLookupInputSchema = z
  .object({
    workspaceId: z.string().uuid(),
    ids: z.array(z.string().uuid()).min(1).max(30),
  })
  .strict();
export function parseNotificationCenterLookup(raw: unknown) {
  const result = z
    .object({
      items: z.array(rawItemSchema).max(30),
      checkedAt: z.string().datetime({ offset: true }),
    })
    .parse(raw);
  return { ...result, items: result.items.map(withNotificationEvent) };
}
export const notificationCenterPageSchema = z.object({
  items: z.array(rawItemSchema).max(30),
  unread: z.number().int().min(0).max(100),
  unreadCapped: z.boolean().default(false),
  nextCursor: notificationCenterCursorSchema.nullable(),
  cutoff: z.string().datetime({ offset: true }),
});
export function parseNotificationCenterPage(raw: unknown) {
  const page = notificationCenterPageSchema.parse(raw);
  return { ...page, items: page.items.map(withNotificationEvent) };
}
export type NotificationCenterPage = ReturnType<typeof parseNotificationCenterPage>;
export type NotificationCenterItem = NotificationCenterPage["items"][number];

export function assertNotificationWorkspace(
  context: { userId?: string; activeWorkspaceId?: string },
  expected: string,
) {
  if (!context.userId || !context.activeWorkspaceId || context.activeWorkspaceId !== expected)
    throw new Error("O workspace mudou. Recarregue a central antes de continuar.");
}

/** Keep private activity/comment snapshots out of persistent notification payloads. */
export function activityNotificationContent(id: string, workspaceId: string, comment = false) {
  z.string().uuid().parse(id);
  z.string().uuid().parse(workspaceId);
  return {
    workspace_id: workspaceId,
    entity: "activities",
    entity_id: id,
    link: `/tasks/${id}`,
    body: comment
      ? "Abra a atividade no TechERP para consultar os comentários disponíveis para você."
      : "Abra a atividade no TechERP para consultar os detalhes.",
  };
}

/** The approval record retains its own title/note; the notice contains no snapshot tokens. */
export function workflowApprovalNotificationContent(
  workspaceId: string,
  entity: string,
  id: string,
) {
  z.string().uuid().parse(id);
  z.string().uuid().parse(workspaceId);
  const paths: Record<string, string> = {
    deals: "/deals",
    contacts: "/contacts",
    companies: "/companies",
    leads: "/leads",
    tickets: "/tickets",
    activities: "/tasks",
    ats_jobs: "/jobs",
    ats_candidates: "/candidates",
    people: "/people",
    projects: "/projects",
    contracts: "/contracts",
    proposals: "/proposals",
    services: "/services",
    financial_entries: "/finance/entries",
  };
  return {
    workspace_id: workspaceId,
    entity,
    entity_id: id,
    title: "Aprovação necessária no TechERP",
    body: "Uma execução de workflow aguarda sua decisão. Consulte a origem e as aprovações disponíveis para você.",
    link:
      entity === "project_tasks"
        ? `/projects/tasks?taskId=${id}`
        : paths[entity]
          ? `${paths[entity]}/${id}`
          : null,
  };
}
