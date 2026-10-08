/** Sites que bloqueiam leitura automática (aviso apenas; não impede a tentativa). */
export const BLOCKING_DOMAINS = ["linkedin.com", "indeed.com", "glassdoor.com", "gupy.io"];

export const SITE_BLOCKED_PREFIX = "SITE_BLOCKED:";
export const SITE_BLOCKED_MESSAGE =
  "Este site bloqueia leitura automática. Copie o texto da vaga e cole na opção Texto, ou envie um PDF ou print.";

export function isKnownBlockingUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return BLOCKING_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Status HTTP de recusa do site (rate limit, proibido, LinkedIn 999, login). */
export function isBlockedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status === 999;
}

export function isLoginRedirect(location: string): boolean {
  return /\/(login|signin|sign-in|authwall|uas\/login|checkpoint)/i.test(location);
}

export function siteBlockedError(): Error {
  return new Error(`${SITE_BLOCKED_PREFIX} ${SITE_BLOCKED_MESSAGE}`);
}

export function parseSiteBlocked(message: string): { blocked: boolean; text: string } {
  if (message.startsWith(SITE_BLOCKED_PREFIX))
    return { blocked: true, text: message.slice(SITE_BLOCKED_PREFIX.length).trim() };
  return { blocked: false, text: message };
}
