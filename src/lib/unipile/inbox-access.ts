import { linkedinAccountAccess } from "./account-access";
export function linkedinInboxAccess(
  context: Parameters<typeof linkedinAccountAccess>[0],
  actor: string,
  action: "view" | "create" | "manage",
) {
  const workspace = linkedinAccountAccess(context, actor, action === "view" ? "view" : "manage");
  if (
    context.keys?.["techsales.inbox.linkedin.view.own"] !== true ||
    context.keys?.[`techsales.inbox.linkedin.${action}.own`] !== true
  )
    throw new Error("Sem permissão para a Inbox LinkedIn pessoal.");
  return workspace;
}
