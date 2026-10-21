// Guarda de destino para webhooks de saída (proteção contra SSRF).
// Regras: só HTTPS, porta padrão ou 8443, sem credenciais na URL, sem IP privado/loopback/link-local/
// metadados de nuvem, e o nome do host precisa resolver só para endereços públicos.
// A resolução DNS é injetável (DoH em produção; stub nos testes).

export type Resolver = (host: string) => Promise<string[]>;

export class UnsafeWebhookUrl extends Error {
  constructor(public readonly reason: string) {
    super(`Destino de webhook recusado: ${reason}`);
  }
}

function ipv4Parts(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/** Endereço que nunca pode receber webhook (rede interna, loopback, metadados, reservados). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!v6.includes(":")) return false;
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return (
    /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6) || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8")
  );
}

const BLOCKED_HOSTS =
  /(^|\.)(localhost|local|internal|localdomain|home\.arpa|metadata\.google\.internal)$/i;

/** Valida a URL e devolve-a normalizada; lança UnsafeWebhookUrl quando recusada. */
export async function assertSafeWebhookUrl(raw: string, resolve: Resolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeWebhookUrl("URL inválida");
  }
  if (url.protocol !== "https:") throw new UnsafeWebhookUrl("use https");
  if (url.username || url.password) throw new UnsafeWebhookUrl("credenciais na URL");
  if (url.port && url.port !== "443" && url.port !== "8443")
    throw new UnsafeWebhookUrl("porta não permitida");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.test(host)) throw new UnsafeWebhookUrl("host interno");
  if (ipv4Parts(host) || host.includes(":")) {
    if (isPrivateAddress(host)) throw new UnsafeWebhookUrl("endereço privado");
    return url;
  }
  if (!host.includes(".")) throw new UnsafeWebhookUrl("host sem domínio");
  let addrs: string[];
  try {
    addrs = await resolve(host);
  } catch {
    throw new UnsafeWebhookUrl("não foi possível resolver o host");
  }
  if (addrs.length === 0) throw new UnsafeWebhookUrl("host sem endereço");
  if (addrs.some(isPrivateAddress)) throw new UnsafeWebhookUrl("host aponta para rede privada");
  return url;
}

/** Resolve A e AAAA via DNS sobre HTTPS (compatível com o runtime de borda). */
export const dohResolver: Resolver = async (host) => {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`DoH ${res.status}`);
    const j = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
  }
  return out;
};
