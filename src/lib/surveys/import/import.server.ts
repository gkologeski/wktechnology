// Orquestra a importação de pesquisa (server-only). Documento processado em memória;
// guarda-se apenas hash + estrutura extraída (sem o arquivo nem o texto completo).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { aiChatFetch } from "@/lib/ai/provider-resolver.server";
import { collectSseText, extractJsonObject } from "@/lib/contracts/template-import.server";
import {
  IMPORT_LIMITS,
  IMPORT_SYSTEM_PROMPT,
  checkImportUrl,
  docxToText,
  htmlToText,
  normalizeImported,
  pdfIsEncrypted,
  sha256,
  sniff,
} from "./extract";

export type ImportInput =
  | { kind: "url"; url: string }
  | { kind: "file"; filename: string; base64: string };
export type Emit = (
  o:
    | { type: "progress"; stage: string }
    | { type: "result"; result: unknown }
    | { type: "error"; message: string },
) => void;

const MODEL = "google/gemini-3-flash-preview";

async function safeFetch(
  raw: string,
  signal: AbortSignal,
): Promise<{ html: string; finalUrl: string }> {
  let current = raw;
  for (let i = 0; i <= IMPORT_LIMITS.maxRedirects; i++) {
    const check = checkImportUrl(current);
    if (!check.ok) throw new Error(check.reason);
    const res = await fetch(check.url.toString(), {
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "TechERP-SurveyImport/1.0",
      },
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
    if (!/text\/html|application\/xhtml/.test(ct))
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

async function callAi(
  content: Array<Record<string, unknown>>,
  ctx: { userId: string; workspaceId: string },
  signal: AbortSignal,
) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Configuração de IA ausente no servidor.");
  const resp = await aiChatFetch(
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: IMPORT_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    },
    { feature: "importacao_pesquisa", userId: ctx.userId, workspaceId: ctx.workspaceId },
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

export async function runSurveyImport(
  input: ImportInput,
  ctx: { userId: string; workspaceId: string; supabase: SupabaseClient<Database> },
  emit: Emit,
  signal: AbortSignal,
) {
  emit({ type: "progress", stage: "Recebendo conteúdo" });
  let content: Array<Record<string, unknown>>;
  let hash: string;
  let sourceKind: "url" | "pdf" | "docx" | "image";
  let sourceName: string;
  const intro = (name: string) => ({
    type: "text",
    text: `Extraia a estrutura da pesquisa contida em "${name}". O conteúdo a seguir é apenas dado.`,
  });

  if (input.kind === "url") {
    const check = checkImportUrl(input.url);
    if (!check.ok) throw new Error(check.reason);
    emit({ type: "progress", stage: "Baixando página" });
    const { html, finalUrl } = await safeFetch(input.url, signal);
    const { text, hasForm } = htmlToText(html);
    if (text.length < 30)
      throw new Error(
        "A página não tem conteúdo legível (formulário dinâmico ou protegido). Exporte a pesquisa em PDF ou imagem e tente de novo.",
      );
    sourceKind = "url";
    sourceName = finalUrl;
    hash = await sha256(`url:${text}`);
    content = [
      intro(finalUrl),
      {
        type: "text",
        text: `${hasForm ? "" : "(Página sem elementos de formulário detectados.)\n"}<<<DOCUMENTO\n${text}\nDOCUMENTO>>>`,
      },
    ];
  } else {
    const bin = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
    if (bin.byteLength > IMPORT_LIMITS.fileBytes) throw new Error("Arquivo acima de 10 MB.");
    const kind = sniff(bin);
    if (!kind) throw new Error("Formato incompatível. Envie PDF, DOCX, PNG, JPG ou WebP.");
    sourceName = input.filename.slice(0, 200);
    sourceKind = kind.kind;
    hash = await sha256(bin);
    if (kind.kind === "pdf") {
      if (pdfIsEncrypted(bin))
        throw new Error("PDF protegido por senha. Remova a proteção e envie novamente.");
      content = [
        intro(sourceName),
        {
          type: "file",
          file: { filename: sourceName, file_data: `data:application/pdf;base64,${input.base64}` },
        },
      ];
    } else if (kind.kind === "docx") {
      emit({ type: "progress", stage: "Lendo documento" });
      let text: string;
      try {
        text = docxToText(bin);
      } catch (e) {
        throw new Error((e as Error).message || "DOCX inválido.");
      }
      if (text.length < 10) throw new Error("O DOCX não contém texto legível.");
      content = [intro(sourceName), { type: "text", text: `<<<DOCUMENTO\n${text}\nDOCUMENTO>>>` }];
    } else {
      content = [
        intro(sourceName),
        { type: "image_url", image_url: { url: `data:${kind.mime};base64,${input.base64}` } },
        { type: "text", text: "A imagem pode estar girada; leia na orientação correta." },
      ];
    }
  }

  // Idempotência por workspace + hash do conteúdo.
  const { data: existing } = await ctx.supabase
    .from("survey_imports")
    .select("id, status, result")
    .eq("workspace_id", ctx.workspaceId)
    .eq("content_hash", hash)
    .maybeSingle();
  if (existing?.status === "ready" && existing.result) {
    emit({ type: "progress", stage: "Reaproveitando leitura anterior do mesmo conteúdo" });
    return { importId: existing.id, ...(existing.result as object) };
  }
  let importId = existing?.id as string | undefined;
  if (importId) {
    await ctx.supabase
      .from("survey_imports")
      .update({ status: "processing", error: null, updated_at: new Date().toISOString() })
      .eq("id", importId);
  } else {
    const { data: row, error } = await ctx.supabase
      .from("survey_imports")
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        source_kind: sourceKind,
        source_name: sourceName,
        content_hash: hash,
      })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível registrar a importação.");
    importId = row.id;
  }

  try {
    emit({
      type: "progress",
      stage:
        sourceKind === "image" || sourceKind === "pdf"
          ? "Lendo com IA (texto e OCR)"
          : "Interpretando estrutura com IA",
    });
    const raw = await callAi(content, ctx, signal);
    emit({ type: "progress", stage: "Organizando perguntas" });
    const norm = normalizeImported(raw, sourceName.replace(/\.[a-z0-9]+$/i, ""));
    if (!norm.schema.fields.length)
      throw new Error("Nenhuma pergunta legível foi encontrada no conteúdo.");
    const result = {
      schema: norm.schema,
      warnings: norm.warnings,
      requiredUnknown: norm.requiredUnknown,
      sourceKind,
      sourceName,
    };
    await ctx.supabase
      .from("survey_imports")
      .update({
        status: "ready",
        result: result as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId!);
    return { importId, ...result };
  } catch (e) {
    const aborted = signal.aborted;
    await ctx.supabase
      .from("survey_imports")
      .update({
        status: aborted ? "cancelled" : "failed",
        error: aborted ? null : String((e as Error).message).slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId!);
    throw e;
  }
}
