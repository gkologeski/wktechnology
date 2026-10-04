/** Provedores de e-mail pessoal e redes sociais: nunca representam a marca. */
const ALWAYS_GENERIC = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
]);

/**
 * Portais que também oferecem e-mail gratuito. São genéricos só quando o
 * domínio vem de um e-mail; no Site/Domínio da empresa, são a própria marca.
 */
const PROVIDER_PORTALS = new Set(["uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br"]);

/** Extrai o domínio canônico (sem protocolo, www, caminho ou porta). */
export function extractRootDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.split("@").pop() ?? "";
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.split(":")[0] ?? "";
  s = s.replace(/^www\d*\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

/** Indica se o domínio é de e-mail gratuito (ou portal, quando veio de e-mail). */
export function isGenericDomain(domain: string, fromEmail = false): boolean {
  return ALWAYS_GENERIC.has(domain) || (fromEmail && PROVIDER_PORTALS.has(domain));
}

/** Domínio corporativo vindo de um e-mail; nulo para e-mails gratuitos. */
export function corporateDomainFromEmail(email: string | null | undefined): string | null {
  const d = extractRootDomain(email);
  return d && !isGenericDomain(d, true) ? d : null;
}

/** Domínio utilizável para logotipo a partir dos campos Domínio/Site da empresa. */
export function logoDomain(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const fromEmail = !!c && c.includes("@");
    const d = extractRootDomain(c);
    if (d && !isGenericDomain(d, fromEmail)) return d;
  }
  return null;
}

/** URLs automáticas em ordem de preferência. */
export function autoLogoUrls(domain: string | null): string[] {
  if (!domain) return [];
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}
