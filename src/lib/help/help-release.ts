import { canEditHelp, type HelpAccessInput } from "./help-access";

export function assertHelpReleaseAccess(input: HelpAccessInput): void {
  if (!canEditHelp(input)) throw new Error("Sem permissão para atualizar a Ajuda oficial.");
}

export function shouldReleaseArticle(
  current: { version: number } | undefined,
  incoming: { version: number },
): boolean {
  return !current || current.version < incoming.version;
}