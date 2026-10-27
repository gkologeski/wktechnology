import { describe, expect, it } from "vitest";
import { FakeDb } from "./test-fake-db";
import {
  loadChannelRuntime,
  assertChannelRuntime,
  loadPreviewChannelIdentity,
} from "./channel-runtime.server";
const W = "11111111-1111-4111-8111-111111111111",
  A = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const db = new FakeDb();
  db.t("workspaces").push({ id: W, name: "WK Technology" });
  db.t("sdr_playbooks").push({ id: "bruna", workspace_id: W, name: "Agente Bruna", enabled: true });
  db.t("service_channel_accounts").push({
    id: A,
    workspace_id: W,
    channel: "whatsapp",
    source_key: "phone-bruna",
    label: "Tucano — Bruna",
    display_name: "Bruna",
    enabled: true,
    routing_configured: true,
  });
  db.t("service_channel_bindings").push({
    account_id: A,
    workspace_id: W,
    agent_id: "bruna",
    display_name: "",
    enabled: true,
    inbound: true,
    campaigns: true,
  });
  const input = {
    workspaceId: W,
    channel: "whatsapp" as const,
    sourceKey: "phone-bruna",
    agentId: "bruna",
    origin: "campaign" as const,
  };
  return { db, input };
}
describe("account-bound SDR runtime", () => {
  it("resolves the account display identity rather than the provider company label", async () => {
    const { db, input } = fixture();
    expect(await loadChannelRuntime(db, input)).toMatchObject({
      status: "active",
      identity: { displayName: "Bruna", companyName: "WK Technology" },
    });
  });
  it("discovery preserves legacy routing until explicit account configuration", async () => {
    const { db, input } = fixture();
    db.t("service_channel_accounts")[0].routing_configured = false;
    expect(await loadChannelRuntime(db, input)).toEqual({ status: "legacy" });
  });
  it("does not substitute Lia for Bruna on an existing enrollment", async () => {
    const { db, input } = fixture();
    expect(await loadChannelRuntime(db, { ...input, agentId: "lia" })).toMatchObject({
      status: "blocked",
    });
  });
  it("rechecks deactivation even when a valid identity snapshot exists", async () => {
    const { db, input } = fixture();
    const original = await loadChannelRuntime(db, input);
    if (original.status !== "active") throw Error("fixture");
    db.t("service_channel_accounts")[0].enabled = false;
    await expect(
      assertChannelRuntime(db, { ...input, snapshot: original.identity }),
    ).rejects.toThrow("channel_disabled");
  });
  it("retains the conversation identity when an administrator renames the account", async () => {
    const { db, input } = fixture();
    const original = await loadChannelRuntime(db, input);
    if (original.status !== "active") throw Error("fixture");
    db.t("service_channel_accounts")[0].display_name = "Lia";
    expect(await loadChannelRuntime(db, { ...input, snapshot: original.identity })).toEqual(
      original,
    );
  });
  it("rejects a snapshot from another workspace or account", async () => {
    const { db, input } = fixture();
    const original = await loadChannelRuntime(db, input);
    if (original.status !== "active") throw Error("fixture");
    expect(
      await loadChannelRuntime(db, {
        ...input,
        snapshot: { ...original.identity, workspaceId: A },
      }),
    ).toMatchObject({ status: "blocked" });
    expect(
      await loadChannelRuntime(db, { ...input, snapshot: { ...original.identity, accountId: W } }),
    ).toMatchObject({ status: "blocked" });
  });
  it("keeps receptivo and campaign modes independent", async () => {
    const { db, input } = fixture();
    db.t("service_channel_bindings")[0].campaigns = false;
    expect(await loadChannelRuntime(db, input)).toMatchObject({ status: "blocked" });
    expect(await loadChannelRuntime(db, { ...input, origin: "inbound" })).toMatchObject({
      status: "active",
    });
  });
});

it("does not fall back to legacy after the snapshotted account disappears", async () => {
  const { db, input } = fixture();
  const original = await loadChannelRuntime(db, input);
  if (original.status !== "active") throw Error("fixture");
  db.t("service_channel_accounts").splice(0);
  expect(await loadChannelRuntime(db, { ...input, snapshot: original.identity })).toMatchObject({
    status: "blocked",
    reason: "channel_account_unavailable",
  });
});

describe("sandbox account identity", () => {
  it("previews a disabled account without activating it or changing the binding", async () => {
    const { db } = fixture();
    db.t("service_channel_accounts")[0].enabled = false;
    const result = await loadPreviewChannelIdentity(db, {
      workspaceId: W,
      accountId: A,
      agentId: "bruna",
      agentName: "Agente Bruna",
      assistantName: "Lia",
      companyName: "WK Technology",
    });
    expect(result.displayName).toBe("Bruna");
    expect(db.t("service_channel_accounts")[0].enabled).toBe(false);
    expect(db.t("service_channel_bindings")).toHaveLength(1);
  });
  it("does not preview another agent or workspace through an arbitrary account id", async () => {
    const { db } = fixture();
    const input = {
      workspaceId: W,
      accountId: A,
      agentId: "lia",
      agentName: "Lia",
      assistantName: "Lia",
      companyName: "WK Technology",
    };
    await expect(loadPreviewChannelIdentity(db, input)).rejects.toThrow("Vincule");
    await expect(
      loadPreviewChannelIdentity(db, { ...input, workspaceId: A, agentId: "bruna" }),
    ).rejects.toThrow("Vincule");
  });
});
