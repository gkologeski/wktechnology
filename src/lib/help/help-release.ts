import { canEditHelp, type HelpAccessInput } from "./help-access";

export function assertHelpReleaseAllowed(allowed: boolean): void {
  if (!allowed) throw new Error("Sem permissão para atualizar a Ajuda oficial.");
}

export function assertHelpReleaseAccess(input: HelpAccessInput): void {
  assertHelpReleaseAllowed(canEditHelp(input));
}

export function shouldReleaseArticle(
  current: { version: number } | undefined,
  incoming: { version: number },
): boolean {
  return !current || current.version < incoming.version;
}
