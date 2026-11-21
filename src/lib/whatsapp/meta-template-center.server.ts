import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import {
  buildMetaTemplateComponents,
  metaTemplateDraftSchema,
  parseMetaTemplateDraft,
  getTemplateEditReason,
} from "./meta-template-definition";
import {
  allProviderTemplates,
  templateProvider,
  safeTemplateProviderError,
  MetaTemplateOperationError,
  uploadTemplateBytes,
  type TemplateProvider,
} from "./meta-template-provider.server";
import type {
  MetaTemplate,
  MetaTemplateAction,
  MetaTemplateCatalogue,
  MetaTemplateContext,
  MetaTemplateDeletionPreview,
  MetaTemplateDraft,
  MetaTemplateMutationResult,
  MetaTemplateTarget,
  MetaTemplateJson,
} from "./meta-template-types";

const id = z.string().regex(/^\d{5,30}$/);
const targetSchema = z
  .object({
    id: z.string().regex(/^(cloud|lovable):[0-9a-f-]{36}$/),
    provider: z.enum(["cloud", "lovable"]),
    label: z.string().max(160),
    wabaId: id.nullable(),
    enabled: z.boolean(),
    numbers: z
      .array(z.object({ id, phone: z.string().max(160), label: z.string().max(160) }).strict())
      .max(100),
  })
  .strict();
const contextSchema = z
  .object({
    actor: z.string().uuid(),
    workspace: z.string().uuid(),
    readOnly: z.boolean(),
    capabilities: z
      .object({ view: z.boolean(), create: z.boolean(), update: z.boolean(), delete: z.boolean() })
      .strict(),
    targets: z.array(targetSchema).max(100),
  })
  .strict();
const remoteSchema = z.object({
  id,
  name: z.string().min(1).max(512),
  language: z.string().min(2).max(30),
  status: z.string().max(80),
  category: z.string().max(80),
  components: z.array(z.record(z.unknown())).max(20),
  parameter_format: z.string().max(30).optional(),
  rejected_reason: z.string().max(2000).nullish(),
});
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const componentKeys = new Set([
  "type",
  "text",
  "format",
  "buttons",
  "example",
  "header_text",
  "body_text",
  "header_handle",
  "header_text_named_params",
  "body_text_named_params",
  "param_name",
  "url",
  "phone_number",
  "otp_type",
  "add_security_recommendation",
  "code_expiration_minutes",
  "autofill_text",
  "supported_apps",
  "package_name",
  "signature_hash",
  "zero_tap_terms_accepted",
  "cards",
]);
function publicComponent(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof value === "string") return value.slice(0, 8192);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((entry) => publicComponent(entry, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => componentKeys.has(key))
        .map(([key, val]) => [key, publicComponent(val, depth + 1)]),
    );
  return null;
}
export async function normalizeMetaTemplate(input: unknown): Promise<MetaTemplate> {
  const raw = remoteSchema.parse(input);
  if (JSON.stringify(raw).length > 1_000_000)
    throw new MetaTemplateOperationError("O modelo da Meta excede o tamanho seguro de consulta.");
  const fingerprint = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(raw)))),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const draft = parseMetaTemplateDraft(raw);
  const editReason = getTemplateEditReason(raw);
  return {
    id: raw.id,
    name: raw.name,
    language: raw.language,
    status: raw.status,
    category: raw.category,
    components: publicComponent(raw.components) as Record<string, MetaTemplateJson>[],
    parameterFormat: raw.parameter_format ?? "POSITIONAL",
    rejectionReason: raw.rejected_reason ?? null,
    fingerprint,
    draft,
    editable: draft !== null && editReason === null,
    editReason,
  };
}
function sameTarget(a: MetaTemplateTarget, b: MetaTemplateTarget) {
  return (
    a.id === b.id &&
    a.provider === b.provider &&
    a.wabaId === b.wabaId &&
    b.enabled &&
    a.numbers.map((n) => n.id).join(",") === b.numbers.map((n) => n.id).join(",")
  );
}
type ProviderFactory = typeof templateProvider;
export class MetaTemplateService {
  constructor(
    private client: SupabaseClient,
    private actor: string,
    private workspaceId: string,
    private factory: ProviderFactory = templateProvider,
  ) {}
  async authorize(
    action: MetaTemplateAction = "view",
    targetId?: string,
  ): Promise<MetaTemplateContext> {
    const result = contextSchema.parse(
      await workRpc(this.client, "wa_template_admin_context", {
        p_workspace: this.workspaceId,
        p_action: action,
        p_target: targetId ?? null,
      }),
    );
    if (
      result.actor !== this.actor ||
      result.workspace !== this.workspaceId ||
      !result.capabilities.view ||
      !result.capabilities[action] ||
      (action !== "view" && result.readOnly)
    )
      throw new MetaTemplateOperationError(
        "Sem permissão para esta ação na central de modelos Meta.",
      );
    if (
      targetId &&
      (result.targets.length !== 1 ||
        result.targets[0].id !== targetId ||
        (action !== "view" && !result.targets[0].enabled))
    )
      throw new MetaTemplateOperationError("Conta de modelos indisponível neste workspace.");
    return result;
  }
  private async open(action: MetaTemplateAction, targetId: string) {
    const context = await this.authorize(action, targetId),
      target = context.targets[0];
    return { context, target, provider: await this.factory(this.workspaceId, target) };
  }
  private async beforeWrite(
    action: Exclude<MetaTemplateAction, "view">,
    original: MetaTemplateTarget,
  ) {
    const context = await this.authorize(action, original.id);
    if (!sameTarget(original, context.targets[0]))
      throw new MetaTemplateOperationError(
        "A conexão mudou. Atualize a central antes de continuar.",
      );
    const provider = await this.factory(this.workspaceId, context.targets[0]);
    const latest = await this.authorize(action, original.id);
    if (!sameTarget(original, latest.targets[0]))
      throw new MetaTemplateOperationError("O acesso ou a conexão mudou durante a consulta.");
    return provider;
  }
  async list(targetId: string, cursor?: string): Promise<MetaTemplateCatalogue> {
    const { context, target, provider } = await this.open("view", targetId);
    let result;
    try {
      result = await provider.page(cursor);
    } catch (error) {
      throw safeTemplateProviderError(error);
    }
    const items = await Promise.all(result.data.map(normalizeMetaTemplate));
    const latest = await this.authorize("view", targetId);
    if (!sameTarget(target, latest.targets[0]))
      throw new MetaTemplateOperationError(
        "A conta mudou durante a consulta. Atualize o catálogo.",
      );
    return {
      target: latest.targets[0],
      capabilities: {
        ...latest.capabilities,
        update: latest.capabilities.update && target.provider === "cloud",
      },
      items,
      nextCursor: result.after,
      fetchedAt: new Date().toISOString(),
      providerNote:
        target.provider === "lovable"
          ? "O conector Lovable cria e exclui pelo nome, afetando todos os idiomas. Para mudar um modelo, crie uma nova versão."
          : null,
    };
  }
  private async existing(
    provider: TemplateProvider,
    templateId: string,
    expectedFingerprint: string,
  ) {
    let all: unknown[];
    try {
      all = await allProviderTemplates(provider);
    } catch (error) {
      throw safeTemplateProviderError(error);
    }
    const raw = all.find(
      (row) => row && typeof row === "object" && String((row as any).id) === templateId,
    );
    if (!raw)
      throw new MetaTemplateOperationError(
        "Modelo indisponível na conta selecionada. Atualize o catálogo.",
      );
    const item = await normalizeMetaTemplate(raw);
    if (item.fingerprint !== expectedFingerprint)
      throw new MetaTemplateOperationError(
        "O modelo mudou na Meta. Atualize e revise o conteúdo antes de continuar.",
      );
    return { all, item };
  }
  private async components(draft: MetaTemplateDraft, target: MetaTemplateTarget) {
    const components = buildMetaTemplateComponents(draft);
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.headerFormat)) {
      if (!draft.headerHandle.startsWith("sample:"))
        throw new MetaTemplateOperationError(
          "Envie uma nova amostra de mídia por esta central antes de submeter o modelo.",
        );
      const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
      let ticket: any;
      try {
        ticket = JSON.parse(await decryptApiKey(draft.headerHandle.slice(7)));
      } catch {
        throw new MetaTemplateOperationError(
          "A amostra não é válida para esta operação. Envie o arquivo novamente.",
        );
      }
      if (
        ticket.actor !== this.actor ||
        ticket.workspace !== this.workspaceId ||
        ticket.target !== target.id ||
        ticket.format !== draft.headerFormat ||
        !Number.isFinite(ticket.expiresAt) ||
        ticket.expiresAt <= Date.now() ||
        typeof ticket.handle !== "string"
      )
        throw new MetaTemplateOperationError(
          "A amostra expirou ou pertence a outra conta. Envie o arquivo novamente.",
        );
      const header = components.find((component) => component.type === "HEADER");
      if (!header) throw new MetaTemplateOperationError("Cabeçalho de mídia inválido.");
      header.example = { header_handle: [ticket.handle] };
    }
    return components;
  }
  async create(targetId: string, input: MetaTemplateDraft): Promise<MetaTemplateMutationResult> {
    const draft = metaTemplateDraftSchema.parse(input);
    buildMetaTemplateComponents(draft);
    const { target, provider } = await this.open("create", targetId);
    if (
      target.provider === "lovable" &&
      (draft.parameterFormat !== "POSITIONAL" ||
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.headerFormat))
    )
      throw new MetaTemplateOperationError(
        "Use variáveis numéricas e cabeçalho de texto nesta conexão Lovable. Modelos com mídia devem ser criados no WhatsApp Manager.",
      );
    let all: unknown[];
    try {
      all = await allProviderTemplates(provider);
    } catch (error) {
      throw safeTemplateProviderError(error);
    }
    if (all.some((row: any) => row?.name === draft.name && row?.language === draft.language))
      throw new MetaTemplateOperationError(
        "Já existe um modelo com esse nome e idioma. Atualize o catálogo ou use outro nome.",
      );
    const components = await this.components(draft, target);
    const writer = await this.beforeWrite("create", target);
    try {
      const result: any = await writer.create({
        name: draft.name,
        language: draft.language,
        category: draft.category,
        ...(draft.category !== "AUTHENTICATION" && target.provider === "cloud"
          ? { parameter_format: draft.parameterFormat }
          : {}),
        components,
      });
      if (typeof result?.id === "string" && /^\d{5,30}$/.test(result.id))
        return {
          success: true,
          id: result.id,
          status: typeof result.status === "string" ? result.status : "SUBMITTED",
          message:
            "Modelo submetido à Meta. Atualize o catálogo para acompanhar a revisão e a categoria final.",
        };
      const created: any = (await allProviderTemplates(writer)).find(
        (row: any) => row?.name === draft.name && row?.language === draft.language,
      );
      if (!created?.id)
        throw new MetaTemplateOperationError(
          "A Meta recebeu a operação, mas o novo modelo ainda não foi confirmado. Atualize antes de tentar novamente.",
          true,
        );
      const item = await normalizeMetaTemplate(created);
      return {
        success: true,
        id: item.id,
        status: item.status,
        message: "Modelo localizado na Meta. Confira o status de revisão antes de usá-lo.",
      };
    } catch (error) {
      throw safeTemplateProviderError(error, true);
    }
  }
  async update(
    targetId: string,
    templateId: string,
    expectedFingerprint: string,
    input: MetaTemplateDraft,
  ): Promise<MetaTemplateMutationResult> {
    const draft = metaTemplateDraftSchema.parse(input);
    buildMetaTemplateComponents(draft);
    const { target, provider } = await this.open("update", targetId);
    if (target.provider !== "cloud")
      throw new MetaTemplateOperationError(
        "O conector Lovable não edita modelos existentes. Crie uma nova versão.",
      );
    const { item } = await this.existing(provider, templateId, expectedFingerprint);
    if (!item.editable)
      throw new MetaTemplateOperationError(
        item.editReason ??
          "Este formato deve ser editado no WhatsApp Manager para preservar todos os componentes.",
      );
    if (
      draft.name !== item.name ||
      draft.language !== item.language ||
      (item.status === "APPROVED" && draft.category !== item.category)
    )
      throw new MetaTemplateOperationError(
        "Nome e idioma são imutáveis. A categoria de um modelo aprovado não pode ser alterada por edição.",
      );
    if (draft.parameterFormat !== item.parameterFormat)
      throw new MetaTemplateOperationError(
        "O formato das variáveis não pode mudar nesta edição. Crie uma nova versão do modelo.",
      );
    const components = await this.components(draft, target),
      writer = await this.beforeWrite("update", target);
    await this.existing(writer, templateId, expectedFingerprint);
    const lastAccess = await this.authorize("update", targetId);
    if (!sameTarget(target, lastAccess.targets[0]))
      throw new MetaTemplateOperationError("A conexão mudou durante a revisão. Atualize o modelo.");
    try {
      const result: any = await writer.update(item.id, {
        ...(item.status !== "APPROVED" ? { category: draft.category } : {}),
        components,
      });
      if (result?.success !== true)
        throw new MetaTemplateOperationError(
          "Não foi possível confirmar a edição na Meta. Atualize o catálogo antes de repetir.",
          true,
        );
      return {
        success: true,
        id: item.id,
        status: "SUBMITTED",
        message:
          "Edição recebida pela Meta. A revisão pode tornar o modelo temporariamente indisponível; confira o catálogo.",
      };
    } catch (error) {
      throw safeTemplateProviderError(error, true);
    }
  }
  async inspectDeletion(
    targetId: string,
    templateId: string,
    expectedFingerprint: string,
  ): Promise<MetaTemplateDeletionPreview> {
    const { provider, target } = await this.open("delete", targetId),
      { all, item } = await this.existing(provider, templateId, expectedFingerprint);
    if (["DISABLED", "PENDING_DELETION"].includes(item.status))
      throw new MetaTemplateOperationError(
        "Este modelo está desativado ou já aguarda exclusão na Meta. Atualize o catálogo.",
      );
    const variants =
      target.provider === "lovable"
        ? all.filter((row: any) => row?.name === item.name).map((row) => remoteSchema.parse(row))
        : [item];
    await this.authorize("delete", targetId);
    return {
      scope: target.provider === "cloud" ? "variant" : "all_languages",
      name: item.name,
      language: item.language,
      languages: [...new Set(variants.map((row) => row.language))].sort(),
      variantIds: variants.map((row) => row.id).sort(),
    };
  }
  async remove(
    targetId: string,
    templateId: string,
    expectedFingerprint: string,
    name: string,
    language: string,
    confirmAllLanguages: boolean,
    expectedVariantIds: string[],
  ): Promise<MetaTemplateMutationResult> {
    const preview = await this.inspectDeletion(targetId, templateId, expectedFingerprint);
    if (
      name !== preview.name ||
      language !== preview.language ||
      stable([...new Set(expectedVariantIds)].sort()) !== stable(preview.variantIds) ||
      (preview.scope === "all_languages" && !confirmAllLanguages)
    )
      throw new MetaTemplateOperationError(
        "Confira novamente os idiomas e confirme o alcance exato da exclusão. O catálogo pode ter mudado.",
      );
    const { target } = await this.open("delete", targetId),
      writer = await this.beforeWrite("delete", target);
    const latest = await this.existing(writer, templateId, expectedFingerprint);
    const currentVariantIds =
      preview.scope === "all_languages"
        ? latest.all
            .filter((row: any) => row?.name === name)
            .map((row: any) => remoteSchema.parse(row).id)
            .sort()
        : [latest.item.id];
    if (stable(currentVariantIds) !== stable(preview.variantIds))
      throw new MetaTemplateOperationError(
        "Os idiomas deste nome mudaram na Meta. Confira o alcance da exclusão novamente.",
      );
    const lastAccess = await this.authorize("delete", targetId);
    if (!sameTarget(target, lastAccess.targets[0]))
      throw new MetaTemplateOperationError("A conexão mudou durante a revisão. Atualize o modelo.");
    try {
      const result: any = await writer.remove(templateId, name);
      if (result?.success !== true) {
        const remaining = await allProviderTemplates(writer);
        if (
          remaining.some((row: any) =>
            preview.scope === "all_languages" ? row?.name === name : String(row?.id) === templateId,
          )
        )
          throw new MetaTemplateOperationError(
            "Exclusão ainda não confirmada na Meta. Atualize o catálogo antes de repetir.",
            true,
          );
      }
      return {
        success: true,
        id: templateId,
        status: "DELETED",
        message:
          preview.scope === "all_languages"
            ? "Exclusão recebida para todos os idiomas desse nome na conta Meta."
            : "Exclusão recebida para o modelo e idioma selecionados.",
      };
    } catch (error) {
      throw safeTemplateProviderError(error, true);
    }
  }
  async upload(
    targetId: string,
    action: "create" | "update",
    appId: string,
    filename: string,
    mimeType: string,
    base64: string,
  ): Promise<{ handle: string }> {
    const { target, provider } = await this.open(action, targetId);
    if (target.provider !== "cloud" || !provider.credentials)
      throw new MetaTemplateOperationError(
        "Envie amostras pela conexão direta com a Meta. O conector Lovable não oferece esse upload.",
      );
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      extension = filename.split(".").pop()?.toLowerCase();
    const signature =
      (mimeType === "image/png" &&
        extension === "png" &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) ||
      (mimeType === "image/jpeg" &&
        ["jpg", "jpeg"].includes(extension ?? "") &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255) ||
      (mimeType === "application/pdf" &&
        extension === "pdf" &&
        new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") ||
      (mimeType === "video/mp4" &&
        extension === "mp4" &&
        new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp");
    if (
      !signature ||
      bytes.length === 0 ||
      bytes.length > (mimeType.startsWith("image/") ? 5 : 16) * 1024 * 1024
    )
      throw new MetaTemplateOperationError(
        "A amostra deve ser PNG/JPEG até 5 MB, PDF ou MP4 até 16 MB, com formato e extensão correspondentes.",
      );
    const format = mimeType.startsWith("image/")
      ? "IMAGE"
      : mimeType === "video/mp4"
        ? "VIDEO"
        : "DOCUMENT";
    const before = async () => {
      const latest = await this.authorize(action, targetId);
      if (!sameTarget(target, latest.targets[0]))
        throw new MetaTemplateOperationError("A conexão mudou durante o envio da amostra.");
    };
    try {
      const handle = await uploadTemplateBytes(
        provider.credentials,
        appId,
        bytes,
        mimeType,
        extension!,
        before,
      );
      await before();
      const { encryptApiKey } = await import("@/lib/ai/provider-resolver.server");
      return {
        handle: `sample:${await encryptApiKey(JSON.stringify({ actor: this.actor, workspace: this.workspaceId, target: targetId, format, handle, expiresAt: Date.now() + 60 * 60 * 1000 }))}`,
      };
    } catch (error) {
      throw safeTemplateProviderError(error, true);
    }
  }
}
