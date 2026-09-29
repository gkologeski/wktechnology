// Catálogo único dos domínios da plataforma. Cada categoria tem regra própria:
// - origem canônica: links públicos, sitemap, SEO e fallback de servidor;
// - hosts de produção: hosts aceitos como origem/retorno legítimo;
// - origem OAuth Google: callback registrado no Google Cloud (não trocar sem
//   atualizar o cliente OAuth);
// - domínio de envio: subdomínio verificado para e-mails;
// - domínios internos: e-mails da própria empresa, ignorados em sincronizações.
// Alterar um valor aqui afeta todos os consumidores da categoria.

export const CANONICAL_APP_HOST = "app.wktechnology.com.br";
export const CANONICAL_APP_ORIGIN = `https://${CANONICAL_APP_HOST}`;

export const PRODUCTION_APP_HOSTS: ReadonlySet<string> = new Set([
  CANONICAL_APP_HOST,
  "crm.wktechnology.com.br",
  "ats.wktechnology.com.br",
  "wktechnology.lovable.app",
]);

export const GOOGLE_OAUTH_ORIGIN = "https://crm.wktechnology.com.br";

export const EMAIL_SENDER_DOMAIN = "notify.crm.wktechnology.com.br";

export const INTERNAL_EMAIL_DOMAINS: readonly string[] = [
  "wktechnology.com.br",
  "wkconsultoria.com.br",
];
