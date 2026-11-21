import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateProvider } from "./meta-template-provider.server";
import type {
  MetaTemplateAction,
  MetaTemplateContext,
  MetaTemplateTarget,
} from "./meta-template-types";
import { emptyMetaTemplateDraft } from "./meta-template-types";

const services = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: services.decrypt,
  encryptApiKey: services.encrypt,
}));
vi.mock("./meta-template-provider.server", async (load) => ({
  ...(await load<typeof import("./meta-template-provider.server")>()),
  uploadTemplateBytes: services.upload,
}));
import { MetaTemplateService, normalizeMetaTemplate } from "./meta-template-center.server";

const actor = "b1000000-0000-4000-8000-000000000002";
const workspace = "a1000000-0000-4000-8000-000000000001";
const otherActor = "b1000000-0000-4000-8000-000000000003";
const otherWorkspace = "a1000000-0000-4000-8000-000000000002";
const connection = "c1000000-0000-4000-8000-000000000001";
const actions = ["view", "create", "update", "delete"] as const;
const rawTemplate = {
  id: "111111111111",
  name: "fixture_notice",
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  parameter_format: "POSITIONAL",
  components: [{ type: "BODY", text: "Há uma atualização solicitada. Consulte o TechERP." }],
};
const draft = () => ({
  ...emptyMetaTemplateDraft(),
  name: "fixture_new_notice",
  body: "Há uma atualização solicitada. Consulte o TechERP.",
});
const target = (provider: "cloud" | "lovable" = "cloud"): MetaTemplateTarget => ({
  id: `${provider}:${connection}`,
  provider,
  label: "Fixture account",
  wabaId: provider === "cloud" ? "123456789123" : null,
  enabled: true,
  numbers: [{ id: "123456789", phone: "+5548999990001", label: "Fixture number" }],
});
function harness(providerKind: "cloud" | "lovable" = "cloud") {
  const account = target(providerKind);
  const state: { context: MetaTemplateContext; error: { message: string } | null } = {
    context: {
      actor,
      workspace,
      readOnly: false,
      capabilities: { view: true, create: true, update: true, delete: true },
      targets: [structuredClone(account)],
    },
    error: null,
  };
  const rpc = vi.fn(async () => ({ data: structuredClone(state.context), error: state.error }));
  const provider = {
    target: account,
    credentials: { accessToken: "synthetic-private-token-not-real", apiVersion: "v27.0" },
    page: vi.fn(async (_cursor?: string) => ({
      data: [structuredClone(rawTemplate)] as unknown[],
      after: null as string | null,
    })),
    create: vi
      .fn<TemplateProvider["create"]>()
      .mockResolvedValue({ id: "222222222222", status: "PENDING" }),
    update: vi.fn<TemplateProvider["update"]>().mockResolvedValue({ success: true }),
    remove: vi.fn<TemplateProvider["remove"]>().mockResolvedValue({ success: true }),
  } satisfies TemplateProvider;
  const factory = vi.fn(
    async (_workspace: string, _target: MetaTemplateTarget): Promise<TemplateProvider> => provider,
  );
  const service = new MetaTemplateService(
    { rpc } as unknown as SupabaseClient,
    actor,
    workspace,
    factory,
  );
  return { service, state, rpc, provider, factory, target: account };
}
type Harness = ReturnType<typeof harness>;
async function operate(h: Harness, action: MetaTemplateAction) {
  if (action === "view") return h.service.list(h.target.id);
  if (action === "create") return h.service.create(h.target.id, draft());
  const item = await normalizeMetaTemplate(rawTemplate);
  if (action === "update")
    return h.service.update(h.target.id, item.id, item.fingerprint, {
      ...item.draft!,
      body: "Sua solicitação foi atualizada. Consulte o TechERP.",
    });
  return h.service.remove(
    h.target.id,
    item.id,
    item.fingerprint,
    item.name,
    item.language,
    h.target.provider === "lovable",
    [item.id],
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  services.decrypt.mockReset();
  services.encrypt.mockReset();
  services.upload.mockReset();
  services.encrypt.mockResolvedValue("synthetic-encrypted-sample-ticket");
  services.upload.mockResolvedValue("synthetic-provider-upload-handle");
});

describe("Meta template service authorization", () => {
  it("allows authorized Meta template operations", async () => {
    for (const action of actions) {
      const h = harness();
      const result = await operate(h, action);
      expect(h.rpc).toHaveBeenCalledWith("wa_template_admin_context", {
        p_workspace: workspace,
        p_action: action,
        p_target: h.target.id,
      });
      expect(h.factory).toHaveBeenCalledWith(workspace, h.target);
      if (action === "view")
        expect(result).toMatchObject({
          target: h.target,
          items: [{ id: rawTemplate.id }],
          nextCursor: null,
        });
      else expect(result).toMatchObject({ success: true });
      if (action === "create") {
        expect(h.provider.create).toHaveBeenCalledOnce();
        expect(h.provider.create).toHaveBeenCalledWith({
          name: "fixture_new_notice",
          language: "pt_BR",
          category: "UTILITY",
          parameter_format: "POSITIONAL",
          components: [{ type: "BODY", text: draft().body }],
        });
      }
      if (action === "update") {
        expect(h.provider.update).toHaveBeenCalledOnce();
        expect(h.provider.update).toHaveBeenCalledWith(rawTemplate.id, {
          components: [
            { type: "BODY", text: "Sua solicitação foi atualizada. Consulte o TechERP." },
          ],
        });
      }
      if (action === "delete") {
        expect(h.provider.remove).toHaveBeenCalledOnce();
        expect(h.provider.remove).toHaveBeenCalledWith(rawTemplate.id, rawTemplate.name);
      }
    }
  });
  it("rejects Meta template operations without permission", async () => {
    for (const action of actions) {
      const h = harness();
      h.state.context.capabilities[action] = false;
      await expect(operate(h, action)).rejects.toThrow(/permissão/);
      expect(h.factory).not.toHaveBeenCalled();
    }
  });
  it("honors explicit deny before provider preparation", async () => {
    for (const action of actions) {
      const h = harness();
      h.state.error = { message: "Sem permissão: deny efetivo na RPC." };
      await expect(operate(h, action)).rejects.toThrow(/deny/);
      expect(h.factory).not.toHaveBeenCalled();
    }
  });
  it("rejects foreign workspace or actor before provider preparation", async () => {
    for (const action of actions)
      for (const foreign of [{ workspace: otherWorkspace }, { actor: otherActor }]) {
        const h = harness();
        Object.assign(h.state.context, foreign);
        await expect(operate(h, action)).rejects.toThrow(/permissão/);
        expect(h.factory).not.toHaveBeenCalled();
      }
  });
  it("rejects inactive member before provider preparation", async () => {
    for (const action of actions) {
      const h = harness();
      h.state.error = { message: "Membro ativo obrigatório." };
      await expect(operate(h, action)).rejects.toThrow(/ativo/);
      expect(h.factory).not.toHaveBeenCalled();
    }
  });
});

describe("Meta template mutation fencing", () => {
  it("blocks every mutation in a read-only session before provider preparation", async () => {
    for (const action of ["create", "update", "delete"] as const) {
      const h = harness();
      h.state.context.readOnly = true;
      await expect(operate(h, action)).rejects.toThrow(/permissão/);
      expect(h.factory).not.toHaveBeenCalled();
    }
  });
  it("rejects malformed or credential-bearing permission contexts before provider preparation", async () => {
    for (const change of [
      (h: Harness) => {
        delete (h.state.context as Partial<MetaTemplateContext>).readOnly;
      },
      (h: Harness) => {
        (h.state.context.targets[0] as any).credentials_ciphertext = "synthetic-secret";
      },
      (h: Harness) => {
        h.state.context.actor = "invalid-actor";
      },
      (h: Harness) => {
        h.state.context.targets = [];
      },
      (h: Harness) => {
        h.state.context.targets[0].id = `cloud:${otherActor}`;
      },
    ]) {
      const h = harness();
      change(h);
      await expect(operate(h, "create")).rejects.toThrow();
      expect(h.factory).not.toHaveBeenCalled();
    }
  });
  it("revalidates permission after the provider lookup for every action", async () => {
    for (const action of actions) {
      const h = harness();
      h.provider.page.mockImplementationOnce(async () => {
        h.state.context.capabilities[action] = false;
        return { data: [structuredClone(rawTemplate)], after: null };
      });
      await expect(operate(h, action)).rejects.toThrow(/permissão/);
      expect(h.provider.create).not.toHaveBeenCalled();
      expect(h.provider.update).not.toHaveBeenCalled();
      expect(h.provider.remove).not.toHaveBeenCalled();
    }
  });
  it("revalidates a revocation during the final provider preparation before POST", async () => {
    const h = harness();
    h.factory
      .mockImplementationOnce(async () => h.provider)
      .mockImplementationOnce(async () => {
        h.state.context.capabilities.create = false;
        return h.provider;
      });
    await expect(operate(h, "create")).rejects.toThrow(/permissão/);
    expect(h.provider.create).not.toHaveBeenCalled();
  });
  it("rejects changed account ownership or sender identity before provider mutation", async () => {
    for (const change of [
      (account: MetaTemplateTarget) => {
        account.wabaId = "999999999999";
      },
      (account: MetaTemplateTarget) => {
        account.numbers[0].id = "999999999";
      },
      (account: MetaTemplateTarget) => {
        account.enabled = false;
      },
    ]) {
      const h = harness();
      h.provider.page.mockImplementationOnce(async () => {
        change(h.state.context.targets[0]);
        return { data: [structuredClone(rawTemplate)], after: null };
      });
      await expect(operate(h, "create")).rejects.toThrow(/conexão|Conta|acesso/);
      expect(h.provider.create).not.toHaveBeenCalled();
    }
  });
  it("cannot edit or delete an ID absent from the selected WABA", async () => {
    for (const action of ["update", "delete"] as const) {
      const h = harness();
      h.provider.page.mockResolvedValue({
        data: [{ ...rawTemplate, id: "999999999999" }],
        after: null,
      });
      await expect(operate(h, action)).rejects.toThrow(/indisponível na conta/);
      expect(h.provider.update).not.toHaveBeenCalled();
      expect(h.provider.remove).not.toHaveBeenCalled();
    }
  });
  it("rejects a stale fingerprint before editing or deleting the provider model", async () => {
    const item = await normalizeMetaTemplate(rawTemplate);
    for (const action of ["update", "delete"] as const) {
      const h = harness();
      const operation =
        action === "update"
          ? h.service.update(h.target.id, item.id, "0".repeat(64), item.draft!)
          : h.service.remove(
              h.target.id,
              item.id,
              "0".repeat(64),
              item.name,
              item.language,
              false,
              [item.id],
            );
      await expect(operation).rejects.toThrow(/mudou na Meta/);
      expect(h.provider.update).not.toHaveBeenCalled();
      expect(h.provider.remove).not.toHaveBeenCalled();
    }
  });
  it("keeps name language and approved category immutable during edit", async () => {
    const item = await normalizeMetaTemplate(rawTemplate);
    for (const patch of [
      { name: "different_name" },
      { language: "en_US" },
      { category: "MARKETING" as const },
    ]) {
      const h = harness();
      await expect(
        h.service.update(h.target.id, item.id, item.fingerprint, { ...item.draft!, ...patch }),
      ).rejects.toThrow(/imutáveis|categoria/);
      expect(h.provider.update).not.toHaveBeenCalled();
    }
  });
  it("allows a rejected model category change while preserving immutable identity", async () => {
    const h = harness(),
      rejected = { ...rawTemplate, status: "REJECTED" };
    const item = await normalizeMetaTemplate(rejected);
    h.provider.page.mockResolvedValue({ data: [rejected], after: null });
    await h.service.update(h.target.id, item.id, item.fingerprint, {
      ...item.draft!,
      category: "MARKETING",
    });
    expect(h.provider.update).toHaveBeenCalledWith(item.id, {
      category: "MARKETING",
      components: [{ type: "BODY", text: rawTemplate.components[0].text }],
    });
  });
  it("rejects pending or unsupported models instead of flattening their components", async () => {
    for (const remote of [
      { ...rawTemplate, status: "PENDING" },
      { ...rawTemplate, components: [...rawTemplate.components, { type: "CAROUSEL", cards: [] }] },
    ]) {
      const h = harness(),
        item = await normalizeMetaTemplate(remote);
      h.provider.page.mockResolvedValue({ data: [remote], after: null });
      await expect(
        h.service.update(h.target.id, item.id, item.fingerprint, {
          ...draft(),
          name: rawTemplate.name,
        }),
      ).rejects.toThrow(/Meta|formato|editor/);
      expect(h.provider.update).not.toHaveBeenCalled();
    }
  });
  it("requires duplicate-name reconciliation and never retries an uncertain create", async () => {
    const duplicate = harness();
    await expect(
      duplicate.service.create(duplicate.target.id, { ...draft(), name: rawTemplate.name }),
    ).rejects.toThrow(/Já existe/);
    expect(duplicate.provider.create).not.toHaveBeenCalled();
    const uncertain = harness();
    uncertain.provider.create.mockResolvedValue({ success: true });
    await expect(uncertain.service.create(uncertain.target.id, draft())).rejects.toMatchObject({
      uncertain: true,
    });
    expect(uncertain.provider.create).toHaveBeenCalledOnce();
  });
});

describe("Meta template catalogue and destructive scope", () => {
  it("normalizes public fields without leaking unknown provider credentials", async () => {
    const clean = await normalizeMetaTemplate(rawTemplate);
    const same = await normalizeMetaTemplate({
      category: rawTemplate.category,
      status: rawTemplate.status,
      id: rawTemplate.id,
      name: rawTemplate.name,
      components: rawTemplate.components,
      parameter_format: rawTemplate.parameter_format,
      language: rawTemplate.language,
    });
    expect(clean.fingerprint).toBe(same.fingerprint);
    const remote = {
      ...rawTemplate,
      access_token: "synthetic-secret",
      credentials_ciphertext: "synthetic-private",
      components: [
        {
          ...rawTemplate.components[0],
          access_token: "synthetic-component-secret",
          unexpected: { nested: "synthetic-nested" },
        },
      ],
    };
    const item = await normalizeMetaTemplate(remote);
    expect(JSON.stringify(item)).not.toMatch(
      /synthetic-secret|synthetic-private|synthetic-component-secret|synthetic-nested|access_token|credentials_ciphertext/,
    );
    expect(item.components).toEqual(rawTemplate.components);
    expect(item.editable).toBe(false);
    expect(item.draft).toBeNull();
  });
  it("passes only the explicit cursor and disables unsupported Lovable editing", async () => {
    const h = harness("lovable");
    h.provider.page.mockResolvedValueOnce({ data: [rawTemplate], after: "next-page" });
    const result = await h.service.list(h.target.id, "requested-page");
    expect(h.provider.page).toHaveBeenCalledWith("requested-page");
    expect(result).toMatchObject({ nextCursor: "next-page", capabilities: { update: false } });
    await expect(operate(h, "update")).rejects.toThrow(/Lovable não edita/);
    expect(h.provider.update).not.toHaveBeenCalled();
  });
  it("requires exact language scope and explicit confirmation for Lovable name-wide deletion", async () => {
    const h = harness("lovable");
    const english = { ...rawTemplate, id: "222222222222", language: "en_US" };
    h.provider.page.mockResolvedValue({ data: [rawTemplate, english], after: null });
    const item = await normalizeMetaTemplate(rawTemplate);
    const preview = await h.service.inspectDeletion(h.target.id, item.id, item.fingerprint);
    expect(preview).toEqual({
      scope: "all_languages",
      name: item.name,
      language: "pt_BR",
      languages: ["en_US", "pt_BR"],
      variantIds: [item.id, english.id],
    });
    await expect(
      h.service.remove(
        h.target.id,
        item.id,
        item.fingerprint,
        item.name,
        item.language,
        false,
        preview.variantIds,
      ),
    ).rejects.toThrow(/alcance exato/);
    await expect(
      h.service.remove(h.target.id, item.id, item.fingerprint, item.name, item.language, true, [
        item.id,
      ]),
    ).rejects.toThrow(/alcance exato/);
    await expect(
      h.service.remove(
        h.target.id,
        item.id,
        item.fingerprint,
        "another_name",
        item.language,
        true,
        preview.variantIds,
      ),
    ).rejects.toThrow(/alcance exato/);
    expect(h.provider.remove).not.toHaveBeenCalled();
    expect(
      await h.service.remove(
        h.target.id,
        item.id,
        item.fingerprint,
        item.name,
        item.language,
        true,
        preview.variantIds,
      ),
    ).toMatchObject({ success: true, status: "DELETED" });
    expect(h.provider.remove).toHaveBeenCalledOnce();
  });
  it("rejects new language variants appearing after the deletion preview", async () => {
    const h = harness("lovable"),
      item = await normalizeMetaTemplate(rawTemplate);
    const english = { ...rawTemplate, id: "222222222222", language: "en_US" };
    h.provider.page.mockResolvedValueOnce({ data: [rawTemplate, english], after: null });
    const preview = await h.service.inspectDeletion(h.target.id, item.id, item.fingerprint);
    h.provider.page.mockResolvedValue({
      data: [rawTemplate, english, { ...rawTemplate, id: "333333333333", language: "es" }],
      after: null,
    });
    await expect(
      h.service.remove(
        h.target.id,
        item.id,
        item.fingerprint,
        item.name,
        item.language,
        true,
        preview.variantIds,
      ),
    ).rejects.toThrow(/alcance exato/);
    expect(h.provider.remove).not.toHaveBeenCalled();
  });
});

describe("Meta template media sample tickets", () => {
  const sampleDraft = () => ({
    ...draft(),
    headerFormat: "IMAGE" as const,
    headerHandle: "sample:synthetic-encrypted-ticket",
  });
  const ticket = () => ({
    actor,
    workspace,
    target: target().id,
    format: "IMAGE",
    handle: "synthetic-provider-handle",
    expiresAt: Date.now() + 3600000,
  });
  it.each([
    { actor: otherActor },
    { workspace: otherWorkspace },
    { target: `cloud:${otherActor}` },
    { format: "DOCUMENT" },
    { expiresAt: 0 },
    { expiresAt: "invalid" },
    { handle: null },
  ])(
    "rejects a sample ticket with an invalid actor tenant target format expiry or handle: %j",
    async (patch) => {
      const h = harness();
      services.decrypt.mockResolvedValue(JSON.stringify({ ...ticket(), ...patch }));
      await expect(h.service.create(h.target.id, sampleDraft())).rejects.toThrow(/amostra|Amostra/);
      expect(h.provider.create).not.toHaveBeenCalled();
      expect(services.upload).not.toHaveBeenCalled();
    },
  );
  it("rejects unsealed or undecryptable sample handles", async () => {
    const h = harness();
    await expect(
      h.service.create(h.target.id, { ...sampleDraft(), headerHandle: "raw-provider-handle" }),
    ).rejects.toThrow(/nova amostra/);
    services.decrypt.mockRejectedValue(new Error("synthetic-secret-do-not-display"));
    const result = await h.service
      .create(h.target.id, sampleDraft())
      .catch((error: Error) => error);
    expect(String(result)).not.toContain("synthetic-secret-do-not-display");
    expect(h.provider.create).not.toHaveBeenCalled();
  });
  it("uses only the same-user same-account unexpired provider handle in the submitted components", async () => {
    const h = harness();
    services.decrypt.mockResolvedValue(JSON.stringify(ticket()));
    await h.service.create(h.target.id, sampleDraft());
    expect(h.provider.create).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: ["synthetic-provider-handle"] },
          },
          { type: "BODY", text: draft().body },
        ],
      }),
    );
    expect(JSON.stringify(h.provider.create.mock.calls)).not.toMatch(
      /sample:|synthetic-encrypted-ticket|private-token/,
    );
  });
  it("rejects executable or mismatched file signatures before upload", async () => {
    for (const [filename, mime, bytes] of [
      ["sample.png", "image/png", new TextEncoder().encode("<script>alert(1)</script>")],
      ["sample.jpg", "image/jpeg", new TextEncoder().encode("%PDF-1.7")],
      ["sample.pdf", "application/pdf", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      ["sample.exe", "image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      ["empty.png", "image/png", new Uint8Array()],
    ] as const) {
      const h = harness();
      await expect(
        h.service.upload(
          h.target.id,
          "create",
          "123456789123",
          filename,
          mime,
          Buffer.from(bytes).toString("base64"),
        ),
      ).rejects.toThrow(/formato|Amostra|amostra/);
      expect(services.upload).not.toHaveBeenCalled();
      expect(services.encrypt).not.toHaveBeenCalled();
    }
  });
  it("returns a sealed bound ticket instead of the plaintext provider handle", async () => {
    const h = harness();
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const started = Date.now();
    const result = await h.service.upload(
      h.target.id,
      "create",
      "123456789123",
      "sample.png",
      "image/png",
      Buffer.from(bytes).toString("base64"),
    );
    expect(result).toEqual({ handle: "sample:synthetic-encrypted-sample-ticket" });
    const sealed = JSON.parse(services.encrypt.mock.calls[0][0]);
    expect(sealed).toMatchObject({
      actor,
      workspace,
      target: h.target.id,
      format: "IMAGE",
      handle: "synthetic-provider-upload-handle",
    });
    expect(sealed.expiresAt).toBeGreaterThanOrEqual(started + 3600000);
    expect(JSON.stringify(result)).not.toContain(sealed.handle);
  });
  it("does not mint a ticket if permission is revoked after the sample upload", async () => {
    const h = harness();
    services.upload.mockImplementationOnce(async () => {
      h.state.context.capabilities.create = false;
      return "synthetic-provider-upload-handle";
    });
    await expect(
      h.service.upload(
        h.target.id,
        "create",
        "123456789123",
        "sample.png",
        "image/png",
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"),
      ),
    ).rejects.toThrow();
    expect(services.encrypt).not.toHaveBeenCalled();
  });
});
