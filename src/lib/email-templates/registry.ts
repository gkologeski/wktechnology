import type { ComponentType } from "react";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as mentionNotification } from "./mention-notification";
import { template as workspaceInvite } from "./workspace-invite";
import { template as dunningNotice } from "./dunning-notice";
import { template as activityReminder } from "./activity-reminder";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "mention-notification": mentionNotification,
  "workspace-invite": workspaceInvite,
  "dunning-notice": dunningNotice,
  "activity-reminder": activityReminder,
};
