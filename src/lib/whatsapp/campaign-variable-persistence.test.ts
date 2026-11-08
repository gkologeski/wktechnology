import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: () => "workspace-a" }));
vi.mock("./campaign-rotation-guard.server", () => ({ refreshPendingVariables: vi.fn() }));

import { updateWhatsAppCampaign } from "../whatsapp-campaigns.functions";
import { refreshPendingVariables } from "./campaign-rotation-guard.server";

const oldMap = { "1": { field: "contact.first_name" } };
const newMap = { ...oldMap, "extra#1": { field: "company.name", fallback: "Empresa" } };
let stored: Record<string, unknown>;
let patches: Record<string, unknown>[];
function client(status = "paused") {
  return {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "range"]) q[method] = () => q;
      q.update = (patch: Record<string, unknown>) => {
        patches.push(patch);
        Object.assign(stored, patch);
        return q;
      };
      q.single = () =>
        Promise.resolve({ data: { id: "campaign-a", status, ...stored }, error: null });
      q.then = (resolve: (value: unknown) => void) =>
        resolve({ data: table === "whatsapp_campaign_recipients" ? [] : stored, error: null });
      return q;
    },
  };
}
type Handler = (args: {
  context: { supabase: ReturnType<typeof client>; userId: string };
  data: Record<string, unknown>;
}) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  patches = [];
  stored = {
    audience_config: {
      version: 1,
      manualRaw: "",
      state: {
        mode: "filter",
        base: "contacts",
        groups: [{ logic: "and", filters: [] }],
        variableMap: oldMap,
        recentDays: 7,
      },
    },
  };
});
it.each(["paused", "draft"])(
  "persists extra-template mappings when refreshing a %s campaign without replacing its audience",
  async (status) => {
    await (updateWhatsAppCampaign as unknown as Handler)({
      context: { supabase: client(status), userId: "actor" },
      data: {
        id: "campaign-a",
        refresh_variables: { audience: { type: "filter", base: "contacts" }, variable_map: newMap },
      },
    });
    expect(stored.audience_config).toEqual({
      version: 1,
      manualRaw: "",
      state: {
        mode: "filter",
        base: "contacts",
        groups: [{ logic: "and", filters: [] }],
        recentDays: 7,
        variableMap: newMap,
      },
    });
    expect(refreshPendingVariables).toHaveBeenCalledWith(
      expect.anything(),
      "workspace-a",
      "actor",
      "campaign-a",
      { type: "filter", base: "contacts" },
      newMap,
    );
    expect(patches).toHaveLength(1);
  },
);
it("does not persist mappings when pending-variable validation fails", async () => {
  vi.mocked(refreshPendingVariables).mockRejectedValueOnce(
    new Error("Campo de variável não permitido."),
  );
  await expect(
    (updateWhatsAppCampaign as unknown as Handler)({
      context: { supabase: client(), userId: "actor" },
      data: {
        id: "campaign-a",
        refresh_variables: { audience: { type: "filter", base: "contacts" }, variable_map: newMap },
      },
    }),
  ).rejects.toThrow("Campo de variável não permitido.");
  expect(patches).toEqual([]);
});
it("rejects editing a running campaign without changing saved variables", async () => {
  await expect(
    (updateWhatsAppCampaign as unknown as Handler)({
      context: { supabase: client("running"), userId: "actor" },
      data: {
        id: "campaign-a",
        refresh_variables: { audience: { type: "filter", base: "contacts" }, variable_map: newMap },
      },
    }),
  ).rejects.toThrow("Apenas campanhas em rascunho ou pausadas");
  expect(patches).toEqual([]);
  expect(refreshPendingVariables).not.toHaveBeenCalled();
});
