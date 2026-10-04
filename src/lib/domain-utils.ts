/** Domínios genéricos de e-mail/hospedagem que nunca representam a marca da empresa. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "protonmail.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
]);

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

/** Domínio utilizável para buscar logotipo (exclui provedores genéricos). */
export function logoDomain(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const d = extractRootDomain(c);
    if (d && !GENERIC_DOMAINS.has(d)) return d;
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
