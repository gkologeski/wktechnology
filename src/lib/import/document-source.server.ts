// Preparação de fontes (URL/arquivo/texto) e chamada da IA para importações.
// Server-only. Documento processado em memória; o conteúdo é DADO, nunca instrução.
import { aiChatFetch } from "@/lib/ai/provider-resolver.server";
import type { AiFeature } from "@/lib/ai/features";
import { collectSseText, extractJsonObject } from "@/lib/contracts/template-import.server";
import {
  IMPORT_LIMITS,
  checkImportUrl,
  docxToText,
  htmlToText,
  pdfIsEncrypted,
  sha256,
  sniff,
} from "./document-source";

export type SourceInput =
  | { kind: "url"; url: string }
  | { kind: "file"; filename: string; base64: string }
  | { kind: "text"; text: string; label?: string };

export type PreparedSource = {
  content: Array<Record<string, unknown>>;
  hash: string;
  sourceKind: "url" | "pdf" | "docx" | "image" | "text";
  sourceName: string;
  /** Bytes originais (arquivos) — só para quem precisa guardar em storage privado. */
  bytes?: Uint8Array;
  mime?: string;
};

export const DEFAULT_IMPORT_MODEL = "google/gemini-3-flash-preview";

export async function safeFetchHtml(
  raw: string,
  signal: AbortSignal,
): Promise<{ html: string; finalUrl: string }> {
  let current = raw;
  for (let i = 0; i <= IMPORT_LIMITS.maxRedirects; i++) {
    const check = checkImportUrl(current);
    if (!check.ok) throw new Error(check.reason);
    const timeout = AbortSignal.timeout(IMPORT_LIMITS.fetchTimeoutMs);
    const res = await fetch(check.url.toString(), {
      redirect: "manual",
      signal: AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "TechERP-Import/1.0" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirecionamento inválido.");
      current = new URL(loc, check.url).toString();
      continue;
    }
    if (res.status === 401 || res.status === 403)
      throw new Error("A página exige login ou bloqueia acesso; não é possível importar.");
    if (!res.ok) throw new Error(`A página respondeu com erro ${res.status}.`);
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/.test(ct))
      throw new Error("A URL não aponta para uma página HTML.");
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > IMPORT_LIMITS.htmlBytes) throw new Error("Página grande demais (limite 2 MB).");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Página vazia.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > IMPORT_LIMITS.htmlBytes) {
        await reader.cancel();
        throw new Error("Página grande demais (limite 2 MB).");
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return { html: new TextDecoder().decode(buf), finalUrl: current };
  }
  throw new Error("Redirecionamentos demais.");
}

/** Converte a entrada em partes de mensagem multimodal + hash estável. */
export async function prepareSource(
  input: SourceInput,
  intro: (name: string) => string,
  signal: AbortSignal,
  onStage?: (s: string) => void,
): Promise<PreparedSource> {
  const introPart = (name: string) => ({ type: "text", text: intro(name) });
  if (input.kind === "text") {
    const text = input.text.slice(0, IMPORT_LIMITS.textChars).trim();
    if (text.length < 20) throw new Error("Texto curto demais para importar.");
    const name = (input.label ?? "Texto colado").slice(0, 200);
    return {
      sourceKind: "text",
      sourceName: name,
      hash: await sha256(`text:${text}`),
      content: [introPart(name), { type: "text", text: `<<<DOCUMENTO\n${text}\nDOCUMENTO>>>` }],
    };
  }
  if (input.kind === "url") {
    const check = checkImportUrl(input.url);
    if (!check.ok) throw new Error(check.reason);
    onStage?.("Baixando página");
    const { html, finalUrl } = await safeFetchHtml(input.url, signal);
    const { text } = htmlToText(html);
    if (text.length < 30)
      throw new Error(
        "A página não tem conteúdo legível (dinâmica ou protegida). Exporte em PDF ou imagem e tente de novo.",
      );
    return {
      sourceKind: "url",
      sourceName: finalUrl,
      hash: await sha256(`url:${text}`),
      content: [introPart(finalUrl), { type: "text", text: `<<<DOCUMENTO\n${text}\nDOCUMENTO>>>` }],
    };
  }
  let bin: Uint8Array;
  try {
    bin = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Arquivo corrompido.");
  }
  if (bin.byteLength > IMPORT_LIMITS.fileBytes) throw new Error("Arquivo acima de 10 MB.");
  const kind = sniff(bin);
  if (!kind) throw new Error("Formato incompatível. Envie PDF, DOCX, PNG, JPG ou WebP.");
  const name = input.filename.slice(0, 200);
  const hash = await sha256(bin);
  if (kind.kind === "pdf") {
    if (pdfIsEncrypted(bin))
      throw new Error("PDF protegido por senha. Remova a proteção e envie novamente.");
    return {
      sourceKind: "pdf",
      sourceName: name,
      hash,
      bytes: bin,
      mime: kind.mime,
      content: [
        introPart(name),
        {
          type: "file",
          file: { filename: name, file_data: `data:application/pdf;base64,${input.base64}` },
        },
      ],
    };
  }
  if (kind.kind === "docx") {
    onStage?.("Lendo documento");
    const text = docxToText(bin);
    if (text.length < 10) throw new Error("O DOCX não contém texto legível.");
    return {
      sourceKind: "docx",
      sourceName: name,
      hash,
      bytes: bin,
      mime: kind.mime,
      content: [introPart(name), { type: "text", text: `<<<DOCUMENTO\n${text}\nDOCUMENTO>>>` }],
    };
  }
  return {
    sourceKind: "image",
    sourceName: name,
    hash,
    bytes: bin,
    mime: kind.mime,
    content: [
      introPart(name),
      { type: "image_url", image_url: { url: `data:${kind.mime};base64,${input.base64}` } },
      { type: "text", text: "A imagem pode estar girada; leia na orientação correta." },
    ],
  };
}

/** Chama a IA do workspace (aiChatFetch) pedindo JSON. */
export async function callAiJson(
  systemPrompt: string,
  content: Array<Record<string, unknown>>,
  ctx: { userId: string; workspaceId: string; feature: AiFeature },
  signal: AbortSignal,
  model = DEFAULT_IMPORT_MODEL,
): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Configuração de IA ausente no servidor.");
  const resp = await aiChatFetch(
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    },
    { feature: ctx.feature, userId: ctx.userId, workspaceId: ctx.workspaceId },
  );
  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (resp.status === 403) throw new Error("Uso de IA bloqueado para este workspace.");
    throw new Error(`Falha na leitura pela IA (${resp.status}).`);
  }
  const raw = await resp.text();
  const text = raw.trimStart().startsWith("data:")
    ? collectSseText(raw)
    : (JSON.parse(raw)?.choices?.[0]?.message?.content ?? "");
  try {
    return JSON.parse(extractJsonObject(text)) as unknown;
  } catch {
    throw new Error("A IA não retornou uma estrutura válida. Tente novamente.");
  }
}
