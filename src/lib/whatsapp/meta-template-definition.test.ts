import { describe, expect, it } from "vitest";
import {
  buildMetaTemplateComponents,
  collectTemplateVariables,
  getTemplateEditReason,
  metaTemplateDraftSchema,
  parseMetaTemplateDraft,
} from "./meta-template-definition";
import { emptyMetaTemplateDraft, type MetaTemplateDraft } from "./meta-template-types";

function draft(patch: Partial<MetaTemplateDraft> = {}): MetaTemplateDraft {
  return {
    ...emptyMetaTemplateDraft(),
    name: "techerp_atualizacao",
    body: "Há uma atualização no TechERP.",
    ...patch,
  };
}
function provider(patch: Record<string, unknown> = {}): {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  parameter_format: string;
  components: Record<string, unknown>[];
} {
  return {
    id: "1234567890",
    name: "techerp_atualizacao",
    language: "pt_BR",
    category: "UTILITY",
    status: "APPROVED",
    parameter_format: "POSITIONAL",
    components: [{ type: "BODY", text: "Há uma atualização no TechERP." }],
    ...patch,
  };
}

describe("Meta template variable grammar", () => {
  it("deduplicates repeated references while keeping first appearance", () => {
    expect(
      collectTemplateVariables("Olá {{1}}. {{2}} está pronto para {{1}}.", "POSITIONAL"),
    ).toEqual(["1", "2"]);
    expect(
      collectTemplateVariables(
        "Olá {{nome_cliente}}, consulte {{numero_pedido}} para {{nome_cliente}}.",
        "NAMED",
      ),
    ).toEqual(["nome_cliente", "numero_pedido"]);
  });
  it.each([
    "Olá {{1}",
    "Olá {1}}",
    "Olá {{{1}}}",
    "Olá {{}}",
    "Olá {{ 1 }}",
    "Olá {{0}}",
    "Olá {{01}}",
    "Olá {{2}}",
    "Olá {{1}} e {{3}}",
    "Olá {{2}} e {{1}}",
    "Olá {{1}} e {{nome}}",
  ])("rejects ambiguous positional variables: %s", (text) => {
    expect(() => collectTemplateVariables(text, "POSITIONAL")).toThrow();
  });
  it.each([
    "Olá {{Nome}}",
    "Olá {{nome-cliente}}",
    "Olá {{1}}",
    "Olá {{nome1}}",
    "Olá {{nome cliente}}",
  ])("rejects invalid named variables: %s", (text) => {
    expect(() => collectTemplateVariables(text, "NAMED")).toThrow();
  });
});

describe("Meta template submission contract", () => {
  it("builds positional samples in component-local order and preserves text", () => {
    const value = draft({
      headerFormat: "TEXT",
      headerText: "Atualização de {{1}}",
      headerExample: "Novembro",
      body: "Olá {{1}}, sua solicitação {{2}} está pronta para {{1}}.",
      bodyExamples: { "2": "SOL-204", "1": "Ana" },
      footer: "WK Technology",
      buttons: [
        { type: "URL", text: "Abrir central", url: "https://app.example.com/notifications" },
      ],
    });
    expect(buildMetaTemplateComponents(value)).toEqual([
      {
        type: "HEADER",
        format: "TEXT",
        text: "Atualização de {{1}}",
        example: { header_text: ["Novembro"] },
      },
      { type: "BODY", text: value.body, example: { body_text: [["Ana", "SOL-204"]] } },
      { type: "FOOTER", text: "WK Technology" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Abrir central", url: "https://app.example.com/notifications" },
        ],
      },
    ]);
  });
  it("emits named examples instead of positional arrays", () => {
    expect(
      buildMetaTemplateComponents(
        draft({
          parameterFormat: "NAMED",
          headerFormat: "TEXT",
          headerText: "Pedido {{pedido}}",
          headerExample: "WK-20",
          body: "Olá {{nome}}, consulte {{pedido}} no portal.",
          bodyExamples: { pedido: "WK-20", nome: "Ana" },
        }),
      ),
    ).toEqual([
      {
        type: "HEADER",
        format: "TEXT",
        text: "Pedido {{pedido}}",
        example: { header_text_named_params: [{ param_name: "pedido", example: "WK-20" }] },
      },
      {
        type: "BODY",
        text: "Olá {{nome}}, consulte {{pedido}} no portal.",
        example: {
          body_text_named_params: [
            { param_name: "nome", example: "Ana" },
            { param_name: "pedido", example: "WK-20" },
          ],
        },
      },
    ]);
  });
  it("requires exact samples, including names shadowing Object.prototype", () => {
    expect(() => buildMetaTemplateComponents(draft({ body: "Olá {{1}}, veja o portal." }))).toThrow(
      /exemplo/,
    );
    expect(() =>
      buildMetaTemplateComponents(
        draft({ parameterFormat: "NAMED", body: "Olá {{constructor}}, veja o portal." }),
      ),
    ).toThrow(/exemplo/);
    expect(() => buildMetaTemplateComponents(draft({ bodyExamples: { "1": "Sobra" } }))).toThrow(
      /não correspondem/,
    );
    expect(() =>
      buildMetaTemplateComponents(
        draft({ body: "Olá {{1}}, veja o portal.", bodyExamples: { "1": " " } }),
      ),
    ).toThrow(/exemplo/);
  });
  it("rejects missing or overlong content instead of submitting invalid models", () => {
    expect(metaTemplateDraftSchema.safeParse({ ...draft(), injectedCredential: "x" }).success).toBe(
      false,
    );
    expect(() => buildMetaTemplateComponents(draft({ name: "Modelo com espaço" }))).toThrow(
      /minúsculas/,
    );
    expect(() => buildMetaTemplateComponents(draft({ body: "a".repeat(1025) }))).toThrow(/1.024/);
    expect(() => buildMetaTemplateComponents(draft({ footer: "Código {{1}}" }))).toThrow(/rodapé/);
    expect(() =>
      buildMetaTemplateComponents(
        draft({ headerFormat: "TEXT", headerText: "{{1}} e {{2}}", headerExample: "x" }),
      ),
    ).toThrow(/uma variável/);
    expect(() =>
      buildMetaTemplateComponents(draft({ body: "Olá {{1}}", bodyExamples: { "1": "Ana" } })),
    ).toThrow(/terminar/);
    expect(metaTemplateDraftSchema.safeParse(draft({ language: "es_AR" })).success).toBe(true);
    expect(metaTemplateDraftSchema.safeParse(draft({ language: "fil" })).success).toBe(true);
    expect(metaTemplateDraftSchema.safeParse(draft({ language: "português" })).success).toBe(false);
  });
  it.each(["IMAGE", "VIDEO", "DOCUMENT"] as const)(
    "emits an uploaded %s sample handle without fetching a URL",
    (headerFormat) => {
      expect(
        buildMetaTemplateComponents(
          draft({ headerFormat, headerHandle: "4:opaque-upload-handle" }),
        )[0],
      ).toEqual({
        type: "HEADER",
        format: headerFormat,
        example: { header_handle: ["4:opaque-upload-handle"] },
      });
      expect(() => buildMetaTemplateComponents(draft({ headerFormat }))).toThrow(/arquivo/);
    },
  );
  it("validates dynamic URL samples and preserves the CTA/quick-reply groups", () => {
    const value = draft({
      buttons: [
        {
          type: "URL",
          text: "Ver solicitação",
          url: "https://app.example.com/requests/{{1}}",
          example: "https://app.example.com/requests/REQ-20",
        },
        { type: "PHONE_NUMBER", text: "Ligar para WK", phoneNumber: "+554830121055" },
        { type: "QUICK_REPLY", text: "Não receber avisos" },
      ],
    });
    expect(buildMetaTemplateComponents(value).at(-1)).toEqual({
      type: "BUTTONS",
      buttons: [
        {
          type: "URL",
          text: "Ver solicitação",
          url: "https://app.example.com/requests/{{1}}",
          example: ["https://app.example.com/requests/REQ-20"],
        },
        { type: "PHONE_NUMBER", text: "Ligar para WK", phone_number: "+554830121055" },
        { type: "QUICK_REPLY", text: "Não receber avisos" },
      ],
    });
    expect(() =>
      buildMetaTemplateComponents(
        draft({
          buttons: [
            { type: "QUICK_REPLY", text: "Sim" },
            { type: "URL", text: "Portal", url: "https://app.example.com" },
            { type: "QUICK_REPLY", text: "Não" },
          ],
        }),
      ),
    ).toThrow(/Agrupe/);
  });
  it.each([
    "http://app.example.com",
    "javascript:alert(1)",
    "https://user:secret@app.example.com",
    "https://app.example.com/a\u0000b",
    "https://app.example.com/a\u001fb",
    "https://app.example.com/a\u007fb",
    "https://localhost/path",
    "https://service.internal/path",
    "https://127.0.0.1/path",
    "https://2130706433/path",
    "https://[::ffff:127.0.0.1]/path",
    "https://app.example.com\\@localhost/a",
  ])("rejects unsafe link destinations: %s", (url) => {
    expect(() =>
      buildMetaTemplateComponents(draft({ buttons: [{ type: "URL", text: "Abrir", url }] })),
    ).toThrow(/URL/);
  });
  it("rejects URL substitution in the host, absent samples and sample origin changes", () => {
    for (const button of [
      { type: "URL" as const, text: "Abrir", url: "https://app.example.com/{{1}}" },
      {
        type: "URL" as const,
        text: "Abrir",
        url: "https://{{1}}/a",
        example: "https://evil.example.com/a",
      },
      {
        type: "URL" as const,
        text: "Abrir",
        url: "https://app.example.com/{{1}}/tail",
        example: "https://app.example.com/id/tail",
      },
      {
        type: "URL" as const,
        text: "Abrir",
        url: "https://app.example.com/{{1}}",
        example: "https://evil.example.com/id",
      },
    ])
      expect(() => buildMetaTemplateComponents(draft({ buttons: [button] }))).toThrow();
  });
  it("enforces Meta button counts and uses canonical E.164 validation", () => {
    expect(() =>
      buildMetaTemplateComponents(
        draft({
          buttons: Array.from({ length: 3 }, (_, i) => ({
            type: "URL",
            text: `Link ${i}`,
            url: "https://app.example.com",
          })),
        }),
      ),
    ).toThrow(/dois/);
    expect(() =>
      buildMetaTemplateComponents(
        draft({
          buttons: Array.from({ length: 2 }, () => ({
            type: "PHONE_NUMBER",
            text: "Ligar",
            phoneNumber: "+554830121055",
          })),
        }),
      ),
    ).toThrow(/um botão/);
    expect(() =>
      buildMetaTemplateComponents(
        draft({
          buttons: [{ type: "PHONE_NUMBER", text: "Ligar", phoneNumber: "(48) 3012-1055" }],
        }),
      ),
    ).toThrow(/código do país/);
    expect(() =>
      buildMetaTemplateComponents(
        draft({
          buttons: Array.from({ length: 11 }, () => ({ type: "QUICK_REPLY", text: "Sim" })),
        }),
      ),
    ).toThrow(/dez/);
  });
  it("builds only the documented authentication preset", () => {
    const value = draft({
      category: "AUTHENTICATION",
      body: "",
      authentication: {
        securityRecommendation: true,
        expiresMinutes: 5,
        buttonText: "Copiar código",
      },
    });
    expect(buildMetaTemplateComponents(value)).toEqual([
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 5 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ]);
    expect(() => buildMetaTemplateComponents({ ...value, body: "Código livre" })).toThrow(
      /padrão da Meta/,
    );
    expect(() =>
      buildMetaTemplateComponents({
        ...value,
        authentication: { ...value.authentication, expiresMinutes: 91 },
      }),
    ).toThrow(/90/);
    expect(
      buildMetaTemplateComponents({
        ...value,
        authentication: { securityRecommendation: false, expiresMinutes: null, buttonText: "" },
      }),
    ).toEqual([
      { type: "BODY", add_security_recommendation: false },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
    ]);
  });
});

describe("lossless boundary for the basic Meta template editor", () => {
  it("reads documented text fields and examples without modifying provider metadata", () => {
    const raw = provider({
      quality_score: { score: "GREEN" },
      components: [
        { type: "BODY", text: "Olá {{1}}, há uma atualização.", example: { body_text: [["Ana"]] } },
        {
          type: "BUTTONS",
          buttons: [{ type: "PHONE_NUMBER", text: "Ligar", phone_number: "554830121055" }],
        },
      ],
    });
    const before = JSON.stringify(raw);
    const parsed = parseMetaTemplateDraft(raw);
    expect(parsed?.bodyExamples).toEqual({ "1": "Ana" });
    expect(parsed?.buttons).toEqual([
      { type: "PHONE_NUMBER", text: "Ligar", phoneNumber: "+554830121055" },
    ]);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("maps named samples by name, regardless of provider example order", () => {
    expect(
      parseMetaTemplateDraft(
        provider({
          parameter_format: "NAMED",
          components: [
            {
              type: "BODY",
              text: "Olá {{nome}}, seu pedido {{pedido}} chegou.",
              example: {
                body_text_named_params: [
                  { param_name: "pedido", example: "WK-1" },
                  { param_name: "nome", example: "Ana" },
                ],
              },
            },
          ],
        }),
      )?.bodyExamples,
    ).toEqual({ pedido: "WK-1", nome: "Ana" });
  });
  it.each([
    [{ type: "BODY", text: "Texto", footer_extra: "Não descartar" }],
    [
      { type: "BODY", text: "Texto" },
      { type: "CAROUSEL", cards: [] },
    ],
    [
      { type: "BODY", text: "Texto" },
      { type: "BUTTONS", buttons: [{ type: "FLOW", text: "Abrir fluxo", flow_id: "123" }] },
    ],
    [
      { type: "BODY", text: "Texto" },
      { type: "BODY", text: "Outro texto" },
    ],
    [
      { type: "BODY", text: "Texto" },
      {
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: ["https://cdn.example.com/image.jpg"] },
      },
    ],
    [
      { type: "BODY", text: "Texto" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Portal",
            url: "https://app.example.com",
            extra_content: "preservar",
          },
        ],
      },
    ],
  ])("keeps unsupported or ambiguous components read-only: %j", (...components) => {
    // it.each spreads each row; preserve the original component array.
    expect(parseMetaTemplateDraft(provider({ components }))).toBeNull();
  });
  it("does not invent missing samples or discard multiple example rows", () => {
    expect(
      parseMetaTemplateDraft(
        provider({ components: [{ type: "BODY", text: "Olá {{1}}, veja o portal." }] }),
      ),
    ).toBeNull();
    expect(
      parseMetaTemplateDraft(
        provider({
          components: [
            {
              type: "BODY",
              text: "Olá {{1}}, veja o portal.",
              example: { body_text: [["Ana"], ["Bruna"]] },
            },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      parseMetaTemplateDraft(
        provider({ components: [{ type: "BODY", text: "Texto estático", example: {} }] }),
      )?.body,
    ).toBe("Texto estático");
  });
  it("recognizes the Meta-returned OTP URL only for the copy-code preset", () => {
    const raw = provider({
      category: "AUTHENTICATION",
      components: [
        {
          type: "BODY",
          text: "{{1}} é seu código de verificação.",
          add_security_recommendation: false,
        },
        { type: "FOOTER", text: "Este código expira em 5 minutos.", code_expiration_minutes: 5 },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Copiar código",
              url: "https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}",
            },
          ],
        },
      ],
    });
    const parsed = parseMetaTemplateDraft(raw);
    expect(parsed?.authentication).toEqual({
      securityRecommendation: false,
      expiresMinutes: 5,
      buttonText: "Copiar código",
    });
    expect(parsed?.buttons).toEqual([]);
    expect(parsed && buildMetaTemplateComponents(parsed).at(-1)).toEqual({
      type: "BUTTONS",
      buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }],
    });
    const unsafe = structuredClone(raw);
    (unsafe.components[2] as { buttons: { url: string }[] }).buttons[0].url =
      "https://evil.example.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}";
    expect(parseMetaTemplateDraft(unsafe)).toBeNull();
  });
  it("does not guess ambiguous auth content or convert one-tap OTP into copy-code", () => {
    expect(
      parseMetaTemplateDraft(
        provider({
          category: "AUTHENTICATION",
          components: [
            { type: "BODY", text: "{{1}} is your code." },
            { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      parseMetaTemplateDraft(
        provider({
          category: "AUTHENTICATION",
          components: [
            { type: "BODY", add_security_recommendation: true },
            { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "ONE_TAP", text: "Autofill" }] },
          ],
        }),
      ),
    ).toBeNull();
  });
  it("allows only editable statuses and explains advanced definitions", () => {
    for (const status of ["APPROVED", "REJECTED", "PAUSED"])
      expect(getTemplateEditReason(provider({ status }))).toBeNull();
    for (const status of ["PENDING", "DISABLED", "PENDING_DELETION", "UNKNOWN"])
      expect(getTemplateEditReason(provider({ status }))).toMatch(/somente/);
    expect(
      getTemplateEditReason(provider({ components: [{ type: "CAROUSEL", cards: [] }] })),
    ).toMatch(/sem perda/);
  });
});
