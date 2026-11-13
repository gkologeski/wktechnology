import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ServiceAccount } from "@/lib/prospecting/sdr/channel-accounts.functions";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/prospecting/sdr/channel-accounts.functions", () => ({
  saveServiceChannel: vi.fn(),
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: "workspace", can: () => true }),
}));
vi.mock("./channel-health", () => ({ ChannelHealth: () => null }));
import { AccountEditor } from "./account-editor";

function render(channel: ServiceAccount["channel"], canManage = true) {
  const account = {
    id: "account",
    workspace_id: "workspace",
    channel,
    label: "Conta de teste",
    source_key: "source",
    display_name: "Assistente",
    enabled: true,
    routing_configured: true,
  } as ServiceAccount;
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(AccountEditor, { account, agents: [], canManage }),
    ),
  );
}

it("renders the LinkedIn sequence reply mode in the shared channel editor", () => {
  expect(render("linkedin")).toContain("Após sequências LinkedIn");
});

it("preserves existing campaign modes and excludes website chat", () => {
  expect(render("email")).toContain("Após sequências e campanhas por e-mail");
  expect(render("whatsapp")).toContain("Após campanhas WhatsApp");
  expect(render("chat")).not.toContain("Após sequências");
});

it("keeps the LinkedIn controls disabled without management access", () => {
  expect(render("linkedin", false)).toContain('<fieldset disabled=""');
});
