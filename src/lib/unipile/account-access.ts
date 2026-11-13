function hasLinkedinPermission(keys: Record<string, boolean>, verb: string) {
  return (
    keys[`system.linkedin.${verb}.own`] === true ||
    keys[`system.linkedin.${verb}.workspace`] === true
  );
}
/** Personal LinkedIn credentials remain private even with workspace-wide grants. */
export function linkedinAccountAccess(
  context: {
    actor?: string;
    workspace?: string;
    keys?: Record<string, boolean>;
    read_only?: boolean;
  },
  actor: string,
  action: "view" | "manage",
): string {
  const keys = context.keys ?? {};
  if (
    !context.workspace ||
    context.actor !== actor ||
    !hasLinkedinPermission(keys, "view") ||
    !hasLinkedinPermission(keys, action) ||
    (action !== "view" && context.read_only !== false)
  ) {
    throw new Error("Sem permissão para a conta LinkedIn pessoal no workspace ativo.");
  }
  return context.workspace;
}
