/**
 * Validação de grafo e executor do fluxo. O MESMO executor roda no sandbox
 * (ferramentas simuladas, zero efeitos) e no servidor (ferramentas reais).
 */
import {
  getNodeType,
  validateConfig,
  type Category,
  type Conditions,
  type Config,
  type Dependency,
  type Pair,
} from "./catalog";

export type GraphNode = {
  id: string;
  type: string;
  title?: string;
  config: Config;
  x: number;
  y: number;
};
export type GraphEdge = { id: string; from: string; to: string; port: string };
export type FlowGraph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Issue = { level: "erro" | "aviso"; nodeId?: string; message: string };

export function validateGraph(
  g: FlowGraph,
  opts: { available: readonly Dependency[]; httpAllowlist?: readonly string[] },
): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set(g.nodes.map((n) => n.id));
  const starts = g.nodes.filter((n) => n.type === "start");
  if (starts.length !== 1)
    issues.push({ level: "erro", message: "O fluxo precisa de exatamente um bloco Início." });
  for (const n of g.nodes) {
    const def = getNodeType(n.type);
    if (!def) {
      issues.push({ level: "erro", nodeId: n.id, message: `Tipo desconhecido: ${n.type}` });
      continue;
    }
    for (const m of validateConfig(n.type, n.config, opts.httpAllowlist))
      issues.push({ level: "erro", nodeId: n.id, message: `${n.title || def.label}: ${m}` });
    if (def.dependency && !opts.available.includes(def.dependency))
      issues.push({
        level: "erro",
        nodeId: n.id,
        message: `${def.label}: ferramenta indisponível (${DEPENDENCY_LABEL[def.dependency]}).`,
      });
    if (def.visual) continue;
    const ports = def.outputs(n.config);
    for (const p of ports)
      if (!g.edges.some((e) => e.from === n.id && e.port === p))
        issues.push({
          level: "aviso",
          nodeId: n.id,
          message: `${n.title || def.label}: saída "${p}" sem conexão.`,
        });
    for (const e of g.edges.filter((e) => e.from === n.id))
      if (!ports.includes(e.port))
        issues.push({
          level: "erro",
          nodeId: n.id,
          message: `${n.title || def.label}: conexão em saída inexistente "${e.port}".`,
        });
  }
  for (const e of g.edges) {
    if (!ids.has(e.from) || !ids.has(e.to))
      issues.push({ level: "erro", message: "Conexão aponta para bloco removido." });
    const to = g.nodes.find((n) => n.id === e.to);
    if (to?.type === "start")
      issues.push({ level: "erro", message: "Nada pode apontar para o Início." });
    if (to && getNodeType(to.type)?.visual)
      issues.push({ level: "erro", message: "Nota visual não recebe conexões." });
  }
  if (hasCycle(g))
    issues.push({
      level: "erro",
      message: "O fluxo tem um ciclo; use Agendar lembrete para retomar.",
    });
  const start = starts[0];
  if (start) {
    const reach = new Set<string>([start.id]);
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const e of g.edges)
        if (e.from === id && !reach.has(e.to)) {
          reach.add(e.to);
          stack.push(e.to);
        }
    }
    for (const n of g.nodes)
      if (!reach.has(n.id) && !getNodeType(n.type)?.visual)
        issues.push({
          level: "aviso",
          nodeId: n.id,
          message: `${n.title || n.type}: bloco inalcançável.`,
        });
  }
  return issues;
}

export const DEPENDENCY_LABEL: Record<Dependency, string> = {
  kb: "base de conhecimento",
  catalog: "catálogo de serviços",
  crm: "CRM do workspace",
  calendar: "agenda conectada do anfitrião",
  http_connection: "conexão HTTP com credencial no cofre",
  inbox: "Inbox do workspace",
};

function hasCycle(g: FlowGraph) {
  const state = new Map<string, number>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const e of g.edges) if (e.from === id && visit(e.to)) return true;
    state.set(id, 2);
    return false;
  };
  return g.nodes.some((n) => visit(n.id));
}

export type Contact = { nome?: string; telefone?: string; email?: string; empresa?: string };
export type RunContext = {
  message: string;
  contact: Contact;
  origin: "Receptivo" | "Prospecção";
  vars: Record<string, string>;
  attributes?: Record<string, string>;
};
/** Ferramentas injetadas: sandbox recebe mocks sem efeitos; servidor recebe adaptadores reais. */
export type Tools = {
  mode: "sandbox" | "produção";
  generate: (input: { config: Config; message: string; evidence: string[] }) => Promise<string>;
  findCustomer: () => Promise<Contact | null>;
  kbSearch: (
    q: string,
    sources: string[],
    minScore: number,
  ) => Promise<{ text: string; source: string }[]>;
  catalog: (
    q: string,
    opts: { onlyActive: boolean; category: string },
  ) => Promise<{ name: string; price?: string }[]>;
  slots: (host: string, durationMin: number) => Promise<string[]>;
  effect: (kind: string, payload: Config) => Promise<{ ok: boolean; detail: string }>;
  approval: (config: Config) => Promise<"aprovado" | "recusado" | "pendente">;
  http: (
    config: Config,
    vars: Record<string, string>,
  ) => Promise<{ ok: boolean; value?: string; detail: string }>;
  rating: () => Promise<{ score: number; comment: string } | null>;
};
export type TraceEntry = {
  nodeId: string;
  type: string;
  port: string | null;
  ms: number;
  detail: string;
};
export type RunResult = {
  replies: string[];
  trace: TraceEntry[];
  status: string;
  pausedAt?: string;
};

export const interpolate = (t: string, c: Contact, vars: Record<string, string> = {}) =>
  t.replace(
    /\{\{(\w+)\}\}/g,
    (_, k: string) => (c as Record<string, string | undefined>)[k] ?? vars[k] ?? "",
  );

const s = (v: unknown) => (typeof v === "string" ? v : "");
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function classify(message: string, cats: Category[], fallback: string) {
  const m = norm(message);
  for (const c of cats)
    if (
      c.examples
        .split(",")
        .map((x) => norm(x.trim()))
        .some((x) => x && m.includes(x))
    )
      return c.name;
  return fallback;
}

export function evalConditions(k: Conditions, ctx: RunContext) {
  const value = (f: string) =>
    ({
      Intenção: ctx.vars.intent ?? "",
      Mensagem: ctx.message,
      "Nome do contato": ctx.contact.nome ?? "",
      "E-mail do contato": ctx.contact.email ?? "",
      "Telefone do contato": ctx.contact.telefone ?? "",
    })[f] ?? Object.values(ctx.attributes ?? {}).join(" ");
  const test = (r: { field: string; op: string; value: string }) => {
    const a = norm(value(r.field)),
      b = norm(r.value);
    switch (r.op) {
      case "é":
        return a === b;
      case "não é":
        return a !== b;
      case "contém":
        return a.includes(b);
      case "não contém":
        return !a.includes(b);
      case "preenchido":
        return a.trim() !== "";
      case "vazio":
        return a.trim() === "";
      default:
        return false;
    }
  };
  return k.mode === "OU" ? k.rules.some(test) : k.rules.every(test);
}

const GUARD_PATTERNS: Record<string, RegExp> = {
  "Dados pessoais (PII)":
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
  URLs: /https?:\/\/|www\./i,
  Jailbreak: /ignore (as|all|todas)|modo desenvolvedor|sem restri[cç][oõ]es|DAN\b/i,
  "Prompt injection": /system prompt|instru[cç][oõ]es anteriores|ignore previous/i,
  Moderação: /\b(idiota|imbecil|otário)\b/i,
  "Conteúdo NSFW": /\b(nude|pornô|porn)\b/i,
};
export function guardCheck(message: string, rules: string[], custom: string) {
  const hits = rules.filter((r) => GUARD_PATTERNS[r]?.test(message));
  const words = custom
    .split(",")
    .map((w) => norm(w.trim()))
    .filter(Boolean);
  if (words.some((w) => norm(message).includes(w))) hits.push("Regra customizada");
  return hits;
}

export async function runFlow(
  g: FlowGraph,
  ctx: RunContext,
  tools: Tools,
  maxSteps = 50,
): Promise<RunResult> {
  const replies: string[] = [],
    trace: TraceEntry[] = [],
    evidence: string[] = [];
  let node = g.nodes.find((n) => n.type === "start");
  let status = "sem início";
  for (let step = 0; node && step < maxSteps; step++) {
    const t0 = Date.now();
    const c = node.config;
    let portOut: string | null = null,
      detail = "";
    switch (node.type) {
      case "start":
        if (c.origin !== "Ambas" && c.origin !== ctx.origin) {
          trace.push({
            nodeId: node.id,
            type: node.type,
            port: null,
            ms: 0,
            detail: `Origem ${ctx.origin} não atendida por este fluxo`,
          });
          return { replies, trace, status: "origem não atendida" };
        }
        portOut = "próximo";
        detail = `Origem ${ctx.origin}`;
        break;
      case "guardrails": {
        const hits = guardCheck(ctx.message, list(c.rules), s(c.custom));
        if (hits.length && !c.continueAnyway) {
          portOut = "blocked";
          if (s(c.blockedMessage)) replies.push(s(c.blockedMessage));
        } else portOut = "ok";
        detail = hits.length ? `Detectado: ${hits.join(", ")}` : "Nenhuma regra acionada";
        break;
      }
      case "classify": {
        const cat = classify(ctx.message, list(c.categories), s(c.fallback) || "Outros");
        ctx.vars.intent = cat;
        portOut = cat;
        detail = `Intenção: ${cat}`;
        break;
      }
      case "condition": {
        const ok = evalConditions(c.conditions as Conditions, ctx);
        portOut = ok ? "sim" : "não";
        detail = ok ? "Regras atendidas" : "Regras não atendidas";
        break;
      }
      case "agent": {
        const text = await tools.generate({ config: c, message: ctx.message, evidence });
        replies.push(text);
        portOut = "próximo";
        detail = `Resposta gerada (${evidence.length} evidências)`;
        break;
      }
      case "reply":
        replies.push(interpolate(s(c.text), ctx.contact, ctx.vars));
        portOut = "próximo";
        detail = "Mensagem fixa";
        break;
      case "kb_search": {
        const hits = await tools.kbSearch(ctx.message, list(c.sources), Number(c.minScore ?? 0));
        hits.forEach((h) => evidence.push(`${h.source}: ${h.text}`));
        if (!hits.length && s(c.fallback)) replies.push(s(c.fallback));
        portOut = hits.length ? "encontrado" : "sem resposta";
        detail = hits.length
          ? `Fontes: ${hits.map((h) => h.source).join(", ")}`
          : "Sem evidência nas fontes permitidas";
        break;
      }
      case "catalog": {
        const items = await tools.catalog(ctx.message, {
          onlyActive: c.onlyActive !== false,
          category: s(c.category),
        });
        items.forEach((i) =>
          evidence.push(`Catálogo: ${i.name}${c.showPrice && i.price ? ` (${i.price})` : ""}`),
        );
        portOut = items.length ? "encontrado" : "não encontrado";
        detail = `${items.length} itens`;
        break;
      }
      case "find_customer": {
        const found = await tools.findCustomer();
        if (found) Object.assign(ctx.contact, found);
        portOut = found ? "encontrado" : "não encontrado";
        detail = found ? `Contato ${found.nome ?? ""}` : "Sem contato";
        break;
      }
      case "schedule": {
        const slots = await tools.slots(s(c.host), Number(c.duration ?? 30));
        if (slots.length)
          replies.push(
            `Tenho estes horários com ${s(c.host)}: ${slots.join(", ")}. Qual fica melhor?`,
          );
        portOut = slots.length ? "agendado" : "sem horário";
        detail = `${slots.length} horários de ${s(c.host)} (oferta, sem reserva)`;
        break;
      }
      case "approval": {
        const r = await tools.approval(c);
        if (r === "pendente") {
          replies.push(interpolate(s(c.question), ctx.contact, ctx.vars));
          trace.push({
            nodeId: node.id,
            type: node.type,
            port: null,
            ms: Date.now() - t0,
            detail: "Aguardando confirmação",
          });
          return { replies, trace, status: "aguardando aprovação", pausedAt: node.id };
        }
        portOut = r;
        detail = `Resposta: ${r}`;
        break;
      }
      case "http": {
        const r = await tools.http(c, ctx.vars);
        if (r.value) ctx.vars[s(c.name) || "http"] = r.value;
        portOut = r.ok ? "sucesso" : "erro";
        detail = r.detail;
        break;
      }
      case "evaluate": {
        const r = await tools.rating();
        portOut = r ? "com avaliação" : "sem avaliação";
        detail = r ? `Nota ${r.score}` : "Sem avaliação";
        break;
      }
      case "handoff":
      case "transfer_agent":
      case "capture_lead":
      case "tag":
      case "send_media":
      case "reminder":
      case "internal_note":
      case "prospecting": {
        const payload: Config = { ...c };
        if (node.type === "handoff") {
          replies.push(interpolate(s(c.message), ctx.contact, ctx.vars));
        }
        if (node.type === "internal_note")
          payload.content = interpolate(s(c.content), ctx.contact, ctx.vars);
        if (node.type === "transfer_agent" && !list(c.targets).length) {
          detail = "Sem destino permitido";
          portOut = null;
          break;
        }
        const r = await tools.effect(node.type, payload);
        detail = r.detail;
        portOut = getNodeType(node.type)!.outputs(c)[0] ?? null;
        break;
      }
      case "end":
        trace.push({
          nodeId: node.id,
          type: node.type,
          port: null,
          ms: Date.now() - t0,
          detail: s(c.status),
        });
        return { replies, trace, status: s(c.status) || "concluído" };
      default:
        detail = "Bloco sem executor";
    }
    trace.push({ nodeId: node.id, type: node.type, port: portOut, ms: Date.now() - t0, detail });
    status = portOut
      ? "em andamento"
      : node.type === "handoff"
        ? "transferido para humano"
        : node.type === "transfer_agent"
          ? "transferido para agente"
          : "parado";
    if (!portOut) break;
    const edge = g.edges.find((e) => e.from === node!.id && e.port === portOut);
    if (!edge) {
      status = `saída "${portOut}" sem conexão`;
      break;
    }
    node = g.nodes.find((n) => n.id === edge.to);
  }
  return { replies, trace, status };
}

export type { Pair };
