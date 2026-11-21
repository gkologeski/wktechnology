import { z } from "zod";
import { cloudRequest, MetaCloudError, type MetaCredentials } from "./cloud-api.server";
import type { MetaTemplateTarget } from "./meta-template-types";

const GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";
export const META_TEMPLATE_FIELDS =
  "id,name,language,status,category,components,parameter_format,rejected_reason";
export type TemplateProvider = {
  target: MetaTemplateTarget;
  credentials?: MetaCredentials;
  page: (after?: string) => Promise<{ data: unknown[]; after: string | null }>;
  create: (body: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string, name: string) => Promise<unknown>;
};
export class MetaTemplateOperationError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}
export function safeTemplateProviderError(error: unknown, mutation = false): Error {
  if (error instanceof MetaTemplateOperationError) return error;
  if (error instanceof MetaCloudError) {
    if (mutation && (error.status < 400 || error.status >= 500))
      return new MetaTemplateOperationError(
        "Não foi possível confirmar o resultado na Meta. Atualize o catálogo antes de repetir a operação.",
        true,
      );
    const hint =
      error.code === 190
        ? "Atualize a credencial desta conexão."
        : error.code === 200 || error.code === 10
          ? "Confira o acesso à WABA e a permissão whatsapp_business_management do aplicativo."
          : error.status === 429 || error.code === 80008
            ? "Aguarde o limite informado pela Meta antes de tentar novamente."
            : error.code === 100
              ? "Confira os campos, exemplos, nome e regras de edição do modelo."
              : "Atualize o catálogo e confira o estado na Meta.";
    return new MetaTemplateOperationError(
      `Meta recusou a operação (HTTP ${error.status}${error.code ? `, código ${error.code}` : ""}). ${hint}`,
      mutation && error.status >= 500,
    );
  }
  return new MetaTemplateOperationError(
    mutation
      ? "Não foi possível confirmar o resultado na Meta. Atualize o catálogo antes de repetir a operação."
      : "Não foi possível consultar os modelos na Meta. Confira a conexão e tente atualizar o catálogo.",
    mutation,
  );
}
async function gateway(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown) {
  const access = process.env.LOVABLE_API_KEY,
    connection = process.env.WHATSAPP_API_KEY;
  if (!access || !connection)
    throw new MetaTemplateOperationError("O conector WhatsApp do Lovable não está disponível.");
  const response = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      "X-Connection-Api-Key": connection,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new MetaCloudError(response.status);
  }
  if (!response.ok || data?.error || (response.status >= 300 && response.status < 400))
    throw new MetaCloudError(
      response.status,
      typeof data?.error?.code === "number" ? data.error.code : undefined,
    );
  return data;
}
const pageSchema = z.object({
  data: z.array(z.unknown()).max(100),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().min(1).max(4096).optional() }).optional(),
    })
    .optional(),
});
function readPage(raw: unknown) {
  const result = pageSchema.parse(raw);
  const after = result.paging?.next ? result.paging.cursors?.after : null;
  if (result.paging?.next && !after)
    throw new MetaTemplateOperationError(
      "A Meta retornou uma página incompleta. Atualize o catálogo.",
    );
  return { data: result.data, after: after ?? null };
}
/** The caller has already authorized this exact target. No client-supplied WABA is used. */
export async function templateProvider(
  workspaceId: string,
  target: MetaTemplateTarget,
): Promise<TemplateProvider> {
  if (target.provider === "lovable") {
    const phone = await gateway("/phone_number?fields=id");
    if (!target.numbers.some((number) => number.id === String(phone?.id)))
      throw new MetaTemplateOperationError(
        "Este conector não corresponde ao número autorizado no workspace.",
      );
    return {
      target,
      page: async (after) =>
        readPage(
          await gateway(
            `/message_templates?${new URLSearchParams({ fields: META_TEMPLATE_FIELDS, limit: "100", ...(after ? { after } : {}) })}`,
          ),
        ),
      create: (body) => gateway("/message_templates", "POST", body),
      update: async () => {
        throw new MetaTemplateOperationError(
          "O conector Lovable não edita modelos existentes. Crie uma nova versão.",
        );
      },
      remove: (_id, name) =>
        gateway(`/message_templates?${new URLSearchParams({ name })}`, "DELETE"),
    };
  }
  const connectionId = target.id.slice("cloud:".length);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await (supabaseAdmin as any)
    .from("wa_cloud_connections")
    .select("id,waba_id,enabled,api_version,credentials_ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !row?.enabled || row.waba_id !== target.wabaId)
    throw new MetaTemplateOperationError("Conexão Meta indisponível neste workspace.");
  const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
  const secrets = z
    .object({ accessToken: z.string().min(20).max(4096) })
    .parse(JSON.parse(await decryptApiKey(row.credentials_ciphertext)));
  const credentials = { accessToken: secrets.accessToken, apiVersion: row.api_version as string };
  return {
    target,
    credentials,
    page: async (after) =>
      readPage(
        await cloudRequest(credentials, row.waba_id, "message_templates", {
          query: { fields: META_TEMPLATE_FIELDS, limit: "100", ...(after ? { after } : {}) },
        }),
      ),
    create: (body) =>
      cloudRequest(credentials, row.waba_id, "message_templates", { method: "POST", body }),
    update: (id, body) => cloudRequest(credentials, id, "", { method: "POST", body }),
    remove: (id, name) =>
      cloudRequest(credentials, row.waba_id, "message_templates", {
        method: "DELETE",
        query: { hsm_id: id, name },
      }),
  };
}
export async function allProviderTemplates(provider: TemplateProvider): Promise<unknown[]> {
  const items: unknown[] = [],
    seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await provider.page(cursor);
    items.push(...result.data);
    if (!result.after) return items;
    if (seen.has(result.after))
      throw new MetaTemplateOperationError(
        "A Meta repetiu o cursor do catálogo. Atualize antes de alterar modelos.",
      );
    seen.add(result.after);
    cursor = result.after;
  }
  throw new MetaTemplateOperationError(
    "O catálogo excede o limite de consulta desta central. Use o WhatsApp Manager para esta conta.",
  );
}
/** Upload only client-selected bytes, never a URL. The provider session stays server-side. */
export async function uploadTemplateBytes(
  credentials: MetaCredentials,
  appId: string,
  bytes: Uint8Array,
  mimeType: string,
  extension: string,
  beforeUpload: () => Promise<void>,
) {
  await beforeUpload();
  const session = await cloudRequest(credentials, appId, "uploads", {
    method: "POST",
    body: {
      file_name: `template-sample.${extension}`,
      file_length: bytes.byteLength,
      file_type: mimeType,
    },
  });
  const sessionId = typeof session?.id === "string" ? session.id : "";
  if (!sessionId.startsWith("upload:") || sessionId.length > 4096 || /[\\\s#]/.test(sessionId))
    throw new MetaTemplateOperationError("A Meta retornou uma sessão de amostra inválida.");
  const url = new URL(`https://graph.facebook.com/${credentials.apiVersion}/${sessionId}`);
  if (
    url.origin !== "https://graph.facebook.com" ||
    url.pathname !== `/${credentials.apiVersion}/${sessionId.split("?")[0]}` ||
    [...url.searchParams.keys()].some((key) => key !== "sig")
  )
    throw new MetaTemplateOperationError("A sessão de amostra da Meta não é segura.");
  await beforeUpload();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${credentials.accessToken}`,
      file_offset: "0",
      "Content-Type": mimeType,
    },
    body: new Uint8Array(bytes),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const result: any = await response.json().catch(() => null);
  if (!response.ok || result?.error || typeof result?.h !== "string" || result.h.length > 8192)
    throw new MetaCloudError(
      response.status,
      typeof result?.error?.code === "number" ? result.error.code : undefined,
    );
  return result.h as string;
}
