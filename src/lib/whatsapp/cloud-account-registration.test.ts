import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cloudAccountCallback,
  cloudAccountSubscription,
  registerCloudAccount,
} from "./cloud-account-registration.server";
import { cloudRequest, MetaCloudError } from "./cloud-api.server";

const input = {
  workspaceId: "wk",
  userId: "actor",
  sourceId: "source",
  wabaId: "123456789",
  label: "New account",
};
function setup() {
  const permission = { member: true, allowed: true };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "actor" } } })) },
    rpc: vi.fn(async (name: string, args: any) => ({
      data:
        name === "is_workspace_member"
          ? permission.member && args._workspace === "wk"
          : name === "user_has_permission"
            ? permission.allowed
            : true,
    })),
  };
  const source = {
    id: "source",
    workspace_id: "wk",
    api_version: "v23.0",
    credentials_ciphertext: "encrypted-old",
  };
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: source })),
    insert: vi.fn(() => query),
    single: vi.fn(async () => ({ data: { id: "new-connection" } })),
  };
  const admin = { from: vi.fn(() => query) };
  const services = {
    decrypt: vi.fn(async () =>
      JSON.stringify({
        accessToken: "test-token-never-returned",
        appSecret: "test-app-secret",
        verifyToken: "old-verify-token",
      }),
    ),
    encrypt: vi.fn(async (_value: string) => "encrypted-new"),
    inspect: vi.fn(
      async (_credentials: any, _waba: string): Promise<unknown[]> => [
        { id: "phone", display_phone_number: "+554830121055" },
      ],
    ),
  };
  const run = (patch = {}) => registerCloudAccount(client, admin, { ...input, ...patch }, services);
  return { permission, client, source, query, admin, services, run };
}
afterEach(() => vi.unstubAllGlobals());
describe("stored Meta account registration", () => {
  it("allows authorized registration without exposing or activating credentials", async () => {
    const x = setup();
    expect(await x.run()).toEqual({ id: "new-connection" });
    expect(x.query.eq).toHaveBeenCalledWith("workspace_id", "wk");
    expect(x.services.inspect).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "test-token-never-returned" }),
      "123456789",
    );
    expect(x.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        workspace_id: "wk",
        credentials_ciphertext: "encrypted-new",
        created_by: "actor",
      }),
    );
    const secret = JSON.parse(x.services.encrypt.mock.calls[0][0]);
    expect(secret.verifyToken).toMatch(/^[a-f0-9]{64}$/);
    expect(secret.verifyToken).not.toBe("old-verify-token");
    expect(x.client.rpc).toHaveBeenCalledWith("sales_area_authorize", {
      r: "system.whatsapp",
      a: "manage",
      t: null,
      i: null,
    });
  });
  it("rejects registration without the manage key before reading secrets", async () => {
    const x = setup();
    x.permission.allowed = false;
    await expect(x.run()).rejects.toThrow("Sem permissão");
    expect(x.admin.from).not.toHaveBeenCalled();
    expect(x.services.decrypt).not.toHaveBeenCalled();
  });
  it("honors explicit deny on registration", async () => {
    const x = setup();
    x.client.rpc.mockImplementation(async (name: string) => ({
      data: name !== "user_has_permission",
    }));
    await expect(x.run()).rejects.toThrow("Sem permissão");
    expect(x.services.inspect).not.toHaveBeenCalled();
  });
  it("rejects registration in another workspace", async () => {
    const x = setup();
    await expect(x.run({ workspaceId: "foreign" })).rejects.toThrow("Membro ativo");
    expect(x.admin.from).not.toHaveBeenCalled();
  });
  it("rejects inactive registration before reading secrets", async () => {
    const x = setup();
    x.permission.member = false;
    await expect(x.run()).rejects.toThrow("Membro ativo");
    expect(x.services.decrypt).not.toHaveBeenCalled();
  });
  it("refuses a source belonging to another workspace", async () => {
    const x = setup();
    x.source.workspace_id = "foreign";
    await expect(x.run()).rejects.toThrow("origem indisponível");
    expect(x.services.decrypt).not.toHaveBeenCalled();
  });
  it("does not persist a WABA rejected by Meta", async () => {
    const x = setup();
    x.services.inspect.mockRejectedValue(new MetaCloudError(403, 100));
    await expect(x.run()).rejects.toThrow("falha 403");
    expect(x.query.insert).not.toHaveBeenCalled();
  });
  it("redacts unexpected provider errors", async () => {
    const x = setup();
    x.services.inspect.mockRejectedValue(new Error("test-token-never-returned"));
    await expect(x.run()).rejects.toThrow("Não foi possível validar o acesso");
    expect(x.query.insert).not.toHaveBeenCalled();
  });
  it("does not persist an empty account", async () => {
    const x = setup();
    x.services.inspect.mockResolvedValue([]);
    await expect(x.run()).rejects.toThrow("não retornou números");
    expect(x.query.insert).not.toHaveBeenCalled();
  });
  it("rechecks permission after the remote lookup", async () => {
    const x = setup();
    x.services.inspect.mockImplementation(async () => {
      x.permission.allowed = false;
      return [{ id: "phone" }];
    });
    await expect(x.run()).rejects.toThrow("Sem permissão");
    expect(x.services.encrypt).not.toHaveBeenCalled();
    expect(x.query.insert).not.toHaveBeenCalled();
  });
  it("redacts malformed stored credential contents", async () => {
    const x = setup();
    x.services.decrypt.mockResolvedValue('{"accessToken":"test-token-never-returned"');
    await expect(x.run()).rejects.toThrow("Não foi possível ler as credenciais");
    expect(x.services.inspect).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing registration on conflict", async () => {
    const x = setup();
    x.query.single.mockResolvedValue({ error: { code: "23505" } });
    await expect(x.run()).rejects.toThrow("já está cadastrada");
    expect(x.query.insert).toHaveBeenCalledOnce();
  });
});
describe("per-WABA subscription", () => {
  const first = "aaaaaaaa-0000-4000-8000-000000000001",
    second = "aaaaaaaa-0000-4000-8000-000000000002";
  it("posts a connection-specific callback to the intended WABA without changing the app default", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await cloudRequest(
      { accessToken: "synthetic", apiVersion: "v23.0" },
      "123456789",
      "subscribed_apps",
      cloudAccountSubscription(first, "https://erp.example/path", "v".repeat(64)),
    );
    const [url, request] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://graph.facebook.com/v23.0/123456789/subscribed_apps");
    expect(JSON.parse(request.body)).toEqual({
      override_callback_uri: `https://erp.example/api/public/whatsapp/cloud/${first}`,
      verify_token: "v".repeat(64),
    });
    expect(cloudAccountCallback(second, "https://erp.example")).not.toBe(
      JSON.parse(request.body).override_callback_uri,
    );
    expect(request.method).toBe("POST");
    expect(request.redirect).toBe("manual");
  });
  it("rejects insecure callback origins", () => {
    expect(() => cloudAccountCallback(first, "http://erp.example")).toThrow("HTTPS");
    expect(() => cloudAccountCallback(first, "https://user:pass@erp.example")).toThrow("HTTPS");
  });
  it("rejects invalid connection IDs and missing verification secrets", () => {
    expect(() => cloudAccountCallback("../foreign", "https://erp.example")).toThrow("inválida");
    expect(() => cloudAccountSubscription(first, "https://erp.example", "short")).toThrow(
      "incompleta",
    );
  });
});
