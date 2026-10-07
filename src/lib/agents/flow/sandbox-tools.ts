/**
 * Ferramentas simuladas para o sandbox: nenhuma chamada externa, nenhuma
 * gravação. Cada efeito é apenas registrado no trace como "simulado".
 */
import type { Config } from "./catalog";
import type { Contact, Tools } from "./runtime";

export type SandboxData = {
  persona: string;
  sources: { name: string; text: string; ready: boolean; expiresAt?: string }[];
  catalog: { name: string; active: boolean; category: string; price?: string }[];
  slotsByHost: Record<string, string[]>;
  contact: Contact | null;
  approvals?: "aprovado" | "recusado" | "pendente";
  now?: Date;
};

const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
const words = (t: string) =>
  norm(t)
    .split(/\W+/)
    .filter((w) => w.length > 3);

export function sandboxTools(d: SandboxData): Tools {
  const now = d.now ?? new Date();
  return {
    mode: "sandbox",
    async generate({ config, message, evidence }) {
      const tone = String(config.tone ?? "Consultivo");
      const opener =
        tone === "Objetivo" ? "" : tone === "Acolhedor" ? "Que bom falar com você! " : "";
      if (evidence.length)
        return `${opener}Pelo que temos aqui: ${evidence[0]!.split(": ").slice(1).join(": ")} Quer que eu detalhe algum ponto?`;
      if (/pre[cç]o|valor|quanto custa/i.test(message) && config.pricePolicy !== "Só do catálogo")
        return `${opener}Valores saem numa proposta feita pela equipe, assim ninguém chuta número. Me conta um pouco do cenário?`;
      return `${opener}Sou ${d.persona}. Me conta o que você quer resolver que eu te ajudo por aqui.`;
    },
    async findCustomer() {
      return d.contact;
    },
    async kbSearch(q, sources, minScore) {
      const qw = words(q);
      return d.sources
        .filter(
          (s) =>
            s.ready && sources.includes(s.name) && (!s.expiresAt || new Date(s.expiresAt) > now),
        )
        .map((s) => {
          const sw = new Set(words(s.text + " " + s.name));
          const score = qw.length
            ? Math.round((qw.filter((w) => sw.has(w)).length / qw.length) * 100)
            : 0;
          return { text: s.text, source: s.name, score };
        })
        .filter((h) => h.score >= minScore && h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    },
    async catalog(q, { onlyActive, category }) {
      const qw = words(q);
      return d.catalog.filter(
        (i) =>
          (!onlyActive || i.active) &&
          (!category || i.category === category) &&
          qw.some((w) => norm(i.name + " " + i.category).includes(w)),
      );
    },
    async slots(host) {
      return d.slotsByHost[host] ?? [];
    },
    async effect(kind: string, payload: Config) {
      return {
        ok: true,
        detail: `Simulado (${kind}) · nada gravado ou enviado · ${Object.keys(payload).length} parâmetros`,
      };
    },
    async approval() {
      return d.approvals ?? "pendente";
    },
    async http(c) {
      return { ok: false, detail: `Simulado: ${String(c.method)} não executado no sandbox` };
    },
    async rating() {
      return null;
    },
  };
}
