import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "./access-control/active-workspace.middleware";
import { workRpc } from "./access-control/work-core.server";
import {
  assertNotificationWorkspace,
  notificationCenterQuerySchema,
  parseNotificationCenterPage,
  notificationCenterBadgeSchema,
  notificationCenterLookupInputSchema,
  parseNotificationCenterLookup,
} from "./notification-center";
import {
  centerSettingsPatchSchema,
  normalizeCenterSettings,
} from "./notification-center-preferences";
import { normalizeNotificationPrefs } from "./notification-preferences";

const workspaceInput = z.object({ workspaceId: z.string().uuid() }).strict();
const mutationResult = z.object({ updated: z.number().int().min(0).max(100) });
const preferencesResult = z.object({ settings: z.unknown(), revision: z.number().int().min(0) });

export const getNotificationCenter = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => notificationCenterQuerySchema.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return parseNotificationCenterPage(
      await workRpc(context.supabase, "notification_center_list", {
        p_workspace: data.workspaceId,
        p_scope: data.scope,
        p_status: data.status,
        p_category: data.category ?? null,
        p_q: data.q,
        p_cursor: data.cursor ?? null,
        p_cutoff: data.cutoff ?? null,
        p_module: data.module ?? null,
      }),
    );
  });

export const markCenterNotifications = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    workspaceInput
      .extend({
        ids: z.array(z.string().uuid()).min(1).max(100),
        cutoff: z.string().datetime({ offset: true }),
        read: z.boolean().default(true),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return mutationResult.parse(
      await workRpc(context.supabase, "notification_center_mark", {
        p_workspace: data.workspaceId,
        p_ids: [...new Set(data.ids)],
        p_cutoff: data.cutoff,
        p_read: data.read,
      }),
    );
  });

export const snoozeCenterNotification = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    workspaceInput
      .extend({
        id: z.string().uuid(),
        minutes: z.union([z.literal(0), z.literal(60), z.literal(1440)]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return mutationResult.parse(
      await workRpc(context.supabase, "notification_center_snooze", {
        p_workspace: data.workspaceId,
        p_id: data.id,
        p_minutes: data.minutes,
      }),
    );
  });

export const getCenterPreferences = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => workspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const raw = z
      .object({
        settings: z.unknown(),
        revision: z.number().int().min(0),
        legacyPrefs: z.unknown(),
      })
      .parse(
        await workRpc(context.supabase, "notification_center_preferences", {
          p_workspace: data.workspaceId,
        }),
      );
    return {
      ...raw,
      settings: normalizeCenterSettings(raw.settings),
      legacyPrefs: normalizeNotificationPrefs(raw.legacyPrefs),
    };
  });

export const saveCenterPreferences = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    workspaceInput
      .extend({
        patch: centerSettingsPatchSchema,
        revision: z.number().int().min(0),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const raw = preferencesResult.parse(
      await workRpc(context.supabase, "notification_center_preferences_save", {
        p_workspace: data.workspaceId,
        p_patch: data.patch,
        p_revision: data.revision,
      }),
    );
    return { ...raw, settings: normalizeCenterSettings(raw.settings) };
  });

export const getNotificationCenterBadge = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => workspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return notificationCenterBadgeSchema.parse(
      await workRpc(context.supabase, "notification_center_badge", {
        p_workspace: data.workspaceId,
      }),
    );
  });

export const lookupCenterNotifications = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => notificationCenterLookupInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return parseNotificationCenterLookup(
      await workRpc(context.supabase, "notification_center_lookup", {
        p_workspace: data.workspaceId,
        p_ids: [...new Set(data.ids)],
      }),
    );
  });
