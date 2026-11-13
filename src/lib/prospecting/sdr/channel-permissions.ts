import type { ServiceChannel } from "./channel-identity";
type Context = {
  workspaceId: string | null;
  isLoading: boolean;
  isError: boolean;
  can: (key: string) => boolean;
};
function scopeAllows(context: Context, resource: string, action: string) {
  return ["own", "team", "workspace"].some((scope) =>
    context.can(`${resource}.${action}.${scope}`),
  );
}
/** UI projection only. Every transport operation retains its own server/RLS authorization. */
export function transportCapabilities(
  channel: ServiceChannel,
  context: Context,
  expectedWorkspace = context.workspaceId,
) {
  const denied = {
    view: false,
    create: false,
    update: false,
    remove: false,
    manage: false,
    compose: false,
  };
  if (
    !context.workspaceId ||
    context.workspaceId !== expectedWorkspace ||
    context.isLoading ||
    context.isError
  )
    return denied;
  if (channel === "linkedin") {
    const view =
      context.can("system.linkedin.view.own") || context.can("system.linkedin.view.workspace");
    const manage =
      view &&
      (context.can("system.linkedin.manage.own") ||
        context.can("system.linkedin.manage.workspace"));
    return {
      view,
      create: manage,
      update: manage,
      remove: manage,
      manage,
      compose: manage && context.can("techsales.inbox.linkedin.create.own"),
    };
  }
  if (channel === "email") {
    const allowed = (action: string) => scopeAllows(context, "techsales.email_accounts", action);
    if (!allowed("view")) return denied;
    return {
      view: true,
      create: allowed("create"),
      update: allowed("update"),
      remove: allowed("delete"),
      manage: allowed("manage"),
      compose: ["own", "team", "workspace"].some((scope) =>
        context.can(`techsales.inbox.email.create.${scope}`),
      ),
    };
  }
  const resource = channel === "whatsapp" ? "system.whatsapp" : "system.widget";
  if (!context.can(`${resource}.view.workspace`)) return denied;
  const manage = context.can(`${resource}.manage.workspace`);
  return { view: true, create: manage, update: manage, remove: manage, manage, compose: false };
}
