import { z } from "zod";
import { isValidE164 } from "@/lib/phone/e164";
import {
  emptyMetaTemplateDraft,
  META_TEMPLATE_EDITABLE_STATUSES,
  type MetaTemplateDraft,
} from "./meta-template-types";

type ParameterFormat = MetaTemplateDraft["parameterFormat"];
type Component = Record<string, unknown>;
const invalidFields = "A definição possui campos não reconhecidos.";
const sample = z.string().max(1024, "O exemplo deve ter no máximo 1.024 caracteres.");
const buttonSchema = z
  .object({
    type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
    text: z
      .string()
      .min(1, "Informe o texto do botão.")
      .max(25, "O botão aceita até 25 caracteres."),
    url: z.string().max(2000, "A URL aceita até 2.000 caracteres.").optional(),
    phoneNumber: z.string().max(30, "Informe um telefone em E.164.").optional(),
    example: z.string().max(2000, "O exemplo de URL aceita até 2.000 caracteres.").optional(),
  })
  .strict(invalidFields);

/** Variable names are component-local. Repeated references reuse their sample. */
export function collectTemplateVariables(text: string, format: ParameterFormat): string[] {
  const variables: string[] = [];
  const matches = [...text.matchAll(/\{\{([^{}]+)\}\}/g)];
  if (/[{}]/.test(text.replace(/\{\{([^{}]+)\}\}/g, "")))
    throw Error("Corrija as variáveis: use duas chaves de cada lado, sem chaves incompletas.");
  for (const match of matches) {
    const name = match[1];
    if (format === "POSITIONAL" ? !/^[1-9]\d*$/.test(name) : !/^[a-z][a-z_]*$/.test(name))
      throw Error(
        format === "POSITIONAL"
          ? "Use somente variáveis numéricas sequenciais: {{1}}, {{2}} e assim por diante."
          : "Use somente nomes com letras minúsculas e sublinhado, como {{nome_cliente}}.",
      );
    if (!variables.includes(name)) variables.push(name);
  }
  if (format === "POSITIONAL" && variables.some((name, index) => name !== String(index + 1)))
    throw Error("As variáveis numéricas devem começar em {{1}} e seguir a ordem, sem saltos.");
  return variables;
}

/** These are links in a message, never server-side fetch targets. No DNS request is made. */
function assertTemplateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Error("Informe uma URL HTTPS válida para o botão.");
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    /[\s\\]/.test(raw) ||
    [...raw].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    !host.includes(".") ||
    host.includes(":") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host)
  )
    throw Error("Use uma URL HTTPS de domínio público, sem credenciais ou endereço interno.");
  return url;
}

function validateDefinition(draft: MetaTemplateDraft, ctx: z.RefinementCtx) {
  const fail = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  const variables = (text: string, path: (string | number)[]) => {
    try {
      return collectTemplateVariables(text, draft.parameterFormat);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Variáveis inválidas.", path);
      return [];
    }
  };
  if (draft.category === "AUTHENTICATION") {
    if (
      draft.parameterFormat !== "POSITIONAL" ||
      draft.headerFormat !== "NONE" ||
      draft.headerText ||
      draft.headerExample ||
      draft.headerHandle ||
      draft.body ||
      draft.footer ||
      draft.buttons.length ||
      Object.keys(draft.bodyExamples).length
    )
      fail("Autenticação usa o texto padrão da Meta e o botão Copiar código, sem conteúdo livre.", [
        "category",
      ]);
    return;
  }
  if (!draft.body.trim()) fail("Informe o corpo da mensagem.", ["body"]);
  const bodyVariables = variables(draft.body, ["body"]);
  if (/^\{\{|\}\}$/.test(draft.body.trim()))
    fail("O corpo não pode começar ou terminar com uma variável.", ["body"]);
  for (const name of bodyVariables)
    if (!Object.hasOwn(draft.bodyExamples, name) || !draft.bodyExamples[name]?.trim())
      fail("Preencha um exemplo para cada variável do corpo.", ["bodyExamples", name]);
  if (Object.keys(draft.bodyExamples).some((name) => !bodyVariables.includes(name)))
    fail("Remova os exemplos que não correspondem às variáveis do corpo.", ["bodyExamples"]);
  if (draft.headerFormat === "TEXT") {
    if (!draft.headerText.trim()) fail("Informe o texto do cabeçalho.", ["headerText"]);
    const headerVariables = variables(draft.headerText, ["headerText"]);
    if (headerVariables.length > 1)
      fail("O cabeçalho aceita somente uma variável.", ["headerText"]);
    if (headerVariables.length && !draft.headerExample.trim())
      fail("Informe um exemplo para a variável do cabeçalho.", ["headerExample"]);
  } else if (draft.headerFormat !== "NONE" && !draft.headerHandle.trim())
    fail("Envie um arquivo de exemplo para o cabeçalho de mídia.", ["headerHandle"]);
  if (/[{}]/.test(draft.footer)) fail("O rodapé não aceita variáveis.", ["footer"]);
  let quickReplyGroups = 0;
  let otherGroups = 0;
  let previous: boolean | undefined;
  let urls = 0;
  let phones = 0;
  draft.buttons.forEach((button, index) => {
    const quick = button.type === "QUICK_REPLY";
    if (previous !== quick) {
      if (quick) quickReplyGroups++;
      else otherGroups++;
      previous = quick;
    }
    if (!button.text.trim() || /[{}]/.test(button.text))
      fail("O texto do botão é obrigatório e não aceita variáveis.", ["buttons", index, "text"]);
    if (button.type === "URL") {
      urls++;
      const url = button.url ?? "";
      try {
        const parsed = assertTemplateUrl(url);
        const names = variables(url, ["buttons", index, "url"]);
        if (names.length > 1 || (names.length === 1 && !url.endsWith(`{{${names[0]}}}`)))
          fail("A URL aceita somente uma variável no final do endereço.", [
            "buttons",
            index,
            "url",
          ]);
        if (/[{}]/.test(parsed.host))
          fail("A variável não pode alterar o domínio da URL.", ["buttons", index, "url"]);
        if (names.length === 1) {
          if (!button.example?.trim())
            fail("Informe uma URL completa de exemplo para o botão.", [
              "buttons",
              index,
              "example",
            ]);
          else {
            const example = assertTemplateUrl(button.example);
            const prefix = url.slice(0, -`{{${names[0]}}}`.length);
            if (
              example.origin !== parsed.origin ||
              !button.example.startsWith(prefix) ||
              button.example.length <= prefix.length ||
              /[{}]/.test(button.example)
            )
              fail("A URL de exemplo deve preencher a variável mantendo o mesmo endereço base.", [
                "buttons",
                index,
                "example",
              ]);
          }
        } else if (button.example)
          fail("Use exemplo de URL somente em botão com variável.", ["buttons", index, "example"]);
      } catch (error) {
        fail(error instanceof Error ? error.message : "URL inválida.", ["buttons", index, "url"]);
      }
      if (button.phoneNumber) fail("Botão de URL não aceita telefone.", ["buttons", index]);
    } else if (button.type === "PHONE_NUMBER") {
      phones++;
      if (!isValidE164(button.phoneNumber))
        fail("Informe um telefone válido com +, código do país e número completo.", [
          "buttons",
          index,
          "phoneNumber",
        ]);
      if (button.url || button.example)
        fail("Botão de telefone não aceita URL ou exemplo.", ["buttons", index]);
    } else if (button.url || button.phoneNumber || button.example)
      fail("Resposta rápida aceita somente o texto do botão.", ["buttons", index]);
  });
  if (urls > 2) fail("Use no máximo dois botões de URL.", ["buttons"]);
  if (phones > 1) fail("Use no máximo um botão de telefone.", ["buttons"]);
  if (quickReplyGroups > 1 || otherGroups > 1)
    fail("Agrupe as respostas rápidas antes ou depois dos demais botões, sem intercalar.", [
      "buttons",
    ]);
}

export const metaTemplateDraftSchema: z.ZodType<MetaTemplateDraft> = z
  .object({
    name: z
      .string()
      .min(1, "Informe o nome do modelo.")
      .max(512, "O nome aceita até 512 caracteres.")
      .regex(/^[a-z0-9_]+$/, "Use letras minúsculas, números e sublinhado no nome do modelo."),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/, "Informe um código de idioma válido, como pt_BR."),
    category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
    parameterFormat: z.enum(["POSITIONAL", "NAMED"]),
    headerFormat: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
    headerText: z.string().max(60, "O cabeçalho aceita até 60 caracteres."),
    headerExample: sample,
    headerHandle: z.string().max(16384, "O comprovante de mídia excede o tamanho permitido."),
    body: z.string().max(1024, "O corpo aceita até 1.024 caracteres."),
    bodyExamples: z.record(z.string().max(100), sample),
    footer: z.string().max(60, "O rodapé aceita até 60 caracteres."),
    buttons: z.array(buttonSchema).max(10, "Use no máximo dez botões."),
    authentication: z
      .object({
        securityRecommendation: z.boolean(),
        expiresMinutes: z
          .number()
          .int()
          .min(1, "A expiração mínima é um minuto.")
          .max(90, "A expiração máxima é de 90 minutos.")
          .nullable(),
        buttonText: z.string().max(25, "O botão aceita até 25 caracteres."),
      })
      .strict(invalidFields),
  })
  .strict(invalidFields)
  .superRefine(validateDefinition);

function textExample(
  type: "HEADER" | "BODY",
  names: string[],
  examples: string[],
  format: ParameterFormat,
) {
  if (!names.length) return {};
  const key = type === "HEADER" ? "header" : "body";
  return {
    example:
      format === "NAMED"
        ? {
            [`${key}_text_named_params`]: names.map((param_name, index) => ({
              param_name,
              example: examples[index],
            })),
          }
        : { [`${key}_text`]: type === "BODY" ? [examples] : examples },
  };
}

/** Build only documented fields. Credential-bearing upload tickets are resolved by the server boundary. */
export function buildMetaTemplateComponents(input: MetaTemplateDraft): Component[] {
  const result = metaTemplateDraftSchema.safeParse(input);
  if (!result.success)
    throw Error(result.error.issues[0]?.message ?? "Definição de modelo inválida.");
  const draft = result.data;
  if (draft.category === "AUTHENTICATION") {
    const components: Component[] = [
      { type: "BODY", add_security_recommendation: draft.authentication.securityRecommendation },
    ];
    if (draft.authentication.expiresMinutes !== null)
      components.push({
        type: "FOOTER",
        code_expiration_minutes: draft.authentication.expiresMinutes,
      });
    components.push({
      type: "BUTTONS",
      buttons: [
        {
          type: "OTP",
          otp_type: "COPY_CODE",
          ...(draft.authentication.buttonText ? { text: draft.authentication.buttonText } : {}),
        },
      ],
    });
    return components;
  }
  const components: Component[] = [];
  if (draft.headerFormat === "TEXT") {
    const names = collectTemplateVariables(draft.headerText, draft.parameterFormat);
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: draft.headerText,
      ...textExample(
        "HEADER",
        names,
        names.map(() => draft.headerExample),
        draft.parameterFormat,
      ),
    });
  } else if (draft.headerFormat !== "NONE")
    components.push({
      type: "HEADER",
      format: draft.headerFormat,
      example: { header_handle: [draft.headerHandle] },
    });
  const names = collectTemplateVariables(draft.body, draft.parameterFormat);
  components.push({
    type: "BODY",
    text: draft.body,
    ...textExample(
      "BODY",
      names,
      names.map((name) => draft.bodyExamples[name]),
      draft.parameterFormat,
    ),
  });
  if (draft.footer) components.push({ type: "FOOTER", text: draft.footer });
  if (draft.buttons.length)
    components.push({
      type: "BUTTONS",
      buttons: draft.buttons.map((button) => ({
        type: button.type,
        text: button.text,
        ...(button.type === "URL"
          ? { url: button.url, ...(button.example ? { example: [button.example] } : {}) }
          : {}),
        ...(button.type === "PHONE_NUMBER" ? { phone_number: button.phoneNumber } : {}),
      })),
    });
  return components;
}

function object(value: unknown): value is Component {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(value: Component, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function singleString(value: unknown): string | null {
  return Array.isArray(value) && value.length === 1 && typeof value[0] === "string"
    ? value[0]
    : null;
}
function readExamples(
  component: Component,
  names: string[],
  type: "header" | "body",
  format: ParameterFormat,
): Record<string, string> | null {
  if (component.example === undefined) return names.length ? null : {};
  if (!object(component.example)) return null;
  if (!names.length && !Object.keys(component.example).length) return {};
  const key = format === "NAMED" ? `${type}_text_named_params` : `${type}_text`;
  if (!onlyKeys(component.example, [key])) return null;
  const value = component.example[key];
  if (format === "NAMED") {
    if (!Array.isArray(value) || value.length !== names.length) return null;
    const result: Record<string, string> = {};
    for (const item of value) {
      if (
        !object(item) ||
        !onlyKeys(item, ["param_name", "example"]) ||
        typeof item.param_name !== "string" ||
        typeof item.example !== "string" ||
        !names.includes(item.param_name) ||
        Object.hasOwn(result, item.param_name)
      )
        return null;
      result[item.param_name] = item.example;
    }
    return result;
  }
  const samples =
    type === "body" ? (Array.isArray(value) && value.length === 1 ? value[0] : null) : value;
  if (
    !Array.isArray(samples) ||
    samples.length !== names.length ||
    samples.some((item) => typeof item !== "string")
  )
    return null;
  return Object.fromEntries(names.map((name, index) => [name, samples[index] as string]));
}

function isCopyCodeButton(button: Component) {
  if (button.type === "OTP")
    return onlyKeys(button, ["type", "otp_type", "text"]) && button.otp_type === "COPY_CODE";
  if (
    button.type !== "URL" ||
    !onlyKeys(button, ["type", "text", "url"]) ||
    typeof button.url !== "string"
  )
    return false;
  try {
    const url = new URL(button.url);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      ["www.whatsapp.com", "whatsapp.com"].includes(url.hostname) &&
      /^\/otp\/code\/?$/.test(url.pathname) &&
      [...url.searchParams.keys()].length === 2 &&
      url.searchParams.get("otp_type") === "COPY_CODE" &&
      url.searchParams.get("code") === "otp{{1}}"
    );
  } catch {
    return false;
  }
}

/** Never silently flatten advanced/provider components into the basic editor. */
export function parseMetaTemplateDraft(raw: unknown): MetaTemplateDraft | null {
  if (
    !object(raw) ||
    typeof raw.name !== "string" ||
    typeof raw.language !== "string" ||
    !["UTILITY", "MARKETING", "AUTHENTICATION"].includes(String(raw.category)) ||
    !Array.isArray(raw.components)
  )
    return null;
  const format = raw.parameter_format ?? raw.parameterFormat ?? "POSITIONAL";
  if (
    !["POSITIONAL", "NAMED"].includes(String(format)) ||
    (raw.parameter_format !== undefined &&
      raw.parameterFormat !== undefined &&
      raw.parameter_format !== raw.parameterFormat)
  )
    return null;
  const draft = {
    ...emptyMetaTemplateDraft(),
    name: raw.name,
    language: raw.language,
    category: raw.category as MetaTemplateDraft["category"],
    parameterFormat: format as ParameterFormat,
  };
  const byType = new Map<string, Component>();
  for (const component of raw.components) {
    if (
      !object(component) ||
      typeof component.type !== "string" ||
      !["HEADER", "BODY", "FOOTER", "BUTTONS"].includes(component.type) ||
      byType.has(component.type)
    )
      return null;
    byType.set(component.type, component);
  }
  const body = byType.get("BODY");
  if (!body) return null;
  try {
    if (draft.category === "AUTHENTICATION") {
      if (
        byType.has("HEADER") ||
        !onlyKeys(body, ["type", "text", "add_security_recommendation"]) ||
        (body.text !== undefined &&
          (typeof body.text !== "string" ||
            collectTemplateVariables(body.text, "POSITIONAL").join() !== "1" ||
            /https?:/i.test(body.text))) ||
        (body.add_security_recommendation !== undefined &&
          typeof body.add_security_recommendation !== "boolean")
      )
        return null;
      // Text is generated by Meta for the selected language. A read with text
      // but no security flag is ambiguous; do not guess a different preset.
      if (body.text !== undefined && body.add_security_recommendation === undefined) return null;
      draft.authentication.securityRecommendation = body.add_security_recommendation === true;
      draft.authentication.expiresMinutes = null;
      draft.authentication.buttonText = "";
      const footer = byType.get("FOOTER");
      if (footer) {
        if (
          !onlyKeys(footer, ["type", "text", "code_expiration_minutes"]) ||
          typeof footer.code_expiration_minutes !== "number" ||
          (footer.text !== undefined && typeof footer.text !== "string")
        )
          return null;
        draft.authentication.expiresMinutes = footer.code_expiration_minutes;
      }
      const buttons = byType.get("BUTTONS");
      if (
        !buttons ||
        !onlyKeys(buttons, ["type", "buttons"]) ||
        !Array.isArray(buttons.buttons) ||
        buttons.buttons.length !== 1
      )
        return null;
      const button = buttons.buttons[0];
      if (
        !object(button) ||
        !isCopyCodeButton(button) ||
        (button.text !== undefined && typeof button.text !== "string")
      )
        return null;
      draft.authentication.buttonText = typeof button.text === "string" ? button.text : "";
    } else {
      if (!onlyKeys(body, ["type", "text", "example"]) || typeof body.text !== "string")
        return null;
      draft.body = body.text;
      const names = collectTemplateVariables(draft.body, draft.parameterFormat);
      const examples = readExamples(body, names, "body", draft.parameterFormat);
      if (examples === null) return null;
      draft.bodyExamples = examples;
      const header = byType.get("HEADER");
      if (header) {
        if (!onlyKeys(header, ["type", "format", "text", "example"])) return null;
        if (header.format === "TEXT" && typeof header.text === "string") {
          draft.headerFormat = "TEXT";
          draft.headerText = header.text;
          const names = collectTemplateVariables(draft.headerText, draft.parameterFormat);
          const examples = readExamples(header, names, "header", draft.parameterFormat);
          if (examples === null) return null;
          draft.headerExample = names.length ? examples[names[0]] : "";
        } else if (
          ["IMAGE", "VIDEO", "DOCUMENT"].includes(String(header.format)) &&
          header.text === undefined &&
          object(header.example) &&
          onlyKeys(header.example, ["header_handle"])
        ) {
          const handle = singleString(header.example.header_handle);
          // A provider CDN preview URL is not a reusable upload handle.
          if (!handle || /^https?:/i.test(handle)) return null;
          draft.headerFormat = header.format as MetaTemplateDraft["headerFormat"];
          draft.headerHandle = handle;
        } else return null;
      }
      const footer = byType.get("FOOTER");
      if (footer) {
        if (!onlyKeys(footer, ["type", "text"]) || typeof footer.text !== "string") return null;
        draft.footer = footer.text;
      }
      const buttons = byType.get("BUTTONS");
      if (buttons) {
        if (
          !onlyKeys(buttons, ["type", "buttons"]) ||
          !Array.isArray(buttons.buttons) ||
          !buttons.buttons.length
        )
          return null;
        for (const button of buttons.buttons) {
          if (!object(button) || typeof button.text !== "string") return null;
          if (button.type === "QUICK_REPLY" && onlyKeys(button, ["type", "text"]))
            draft.buttons.push({ type: "QUICK_REPLY", text: button.text });
          else if (
            button.type === "URL" &&
            onlyKeys(button, ["type", "text", "url", "example"]) &&
            typeof button.url === "string"
          ) {
            const example = button.example === undefined ? undefined : singleString(button.example);
            if (example === null) return null;
            draft.buttons.push({
              type: "URL",
              text: button.text,
              url: button.url,
              ...(example !== undefined ? { example } : {}),
            });
          } else if (
            button.type === "PHONE_NUMBER" &&
            onlyKeys(button, ["type", "text", "phone_number"]) &&
            typeof button.phone_number === "string"
          )
            draft.buttons.push({
              type: "PHONE_NUMBER",
              text: button.text,
              phoneNumber: button.phone_number.startsWith("+")
                ? button.phone_number
                : `+${button.phone_number}`,
            });
          else return null;
        }
      }
    }
    const parsed = metaTemplateDraftSchema.safeParse(draft);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function getTemplateEditReason(template: {
  category: string;
  status: string;
  components: Component[];
  parameter_format?: string;
  parameterFormat?: string;
  name?: string;
  language?: string;
}): string | null {
  if (!(META_TEMPLATE_EDITABLE_STATUSES as readonly string[]).includes(template.status))
    return "A Meta permite editar somente modelos aprovados, rejeitados ou pausados.";
  if (
    !parseMetaTemplateDraft({
      ...template,
      name: template.name ?? "modelo",
      language: template.language ?? "pt_BR",
    })
  )
    return "Este modelo contém formato avançado ou dados que o editor não pode alterar sem perda. Gerencie-o na Meta.";
  return null;
}
