import { describe, expect, it, vi } from "vitest";
import {
  assertCloudInboundEnabled,
  assertCloudReceiptProjection,
  recordNotificationCloudReceipt,
  verifiedCloudReceipt,
  type VerifiedCloudReceipt,
} from "./notification-receipt.server";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const senderId = "654321";
const recipient = "+14155552671";
const cloudValue = () => ({
  _verified_workspace_id: workspaceId,
  _verified_connection_id: connectionId,
  metadata: { phone_number_id: senderId },
});
const providerStatus = () => ({
  id: "wamid.synthetic-receipt",
  recipient_id: recipient.slice(1),
  status: "delivered",
});
const receipt = (): VerifiedCloudReceipt => ({
  workspaceId,
  connectionId,
  senderId,
  recipient,
  providerId: "wamid.synthetic-receipt",
  status: "delivered",
  errorCode: null,
});
const message = () => ({
  id: "synthetic-message",
  workspace_id: workspaceId,
  conversation_id: "synthetic-conversation",
  direction: "outbound",
  to_number: recipient,
  raw: { source: { connection_id: connectionId } },
});

type TableResult = { data: Record<string, unknown> | null; error?: unknown };
function fakeAdmin(overrides: Partial<Record<string, TableResult>> = {}) {
  const rows: Record<string, TableResult> = {
    whatsapp_conversations: {
      data: {
        id: "synthetic-conversation",
        workspace_id: workspaceId,
        wa_phone_number_id: senderId,
      },
    },
    wa_cloud_numbers: {
      data: {
        phone_number_id: senderId,
        workspace_id: workspaceId,
        connection_id: connectionId,
        available: true,
      },
    },
    wa_cloud_connections: {
      data: {
        id: connectionId,
        workspace_id: workspaceId,
        enabled: true,
        webhook_verified_at: "2026-11-20T12:00:00Z",
      },
    },
    ...overrides,
  };
  const reads: { table: string; columns: string; filters: Record<string, unknown> }[] = [];
  const mutate = vi.fn(() => {
    throw new Error("Unexpected mutation");
  });
  const rpc = vi.fn().mockResolvedValue({ data: { matched: true, updated: true }, error: null });
  const from = vi.fn((table: string) => {
    const read = { table, columns: "", filters: {} as Record<string, unknown> };
    reads.push(read);
    const query = {
      select: (columns: string) => {
        read.columns = columns;
        return query;
      },
      eq: (key: string, value: unknown) => {
        read.filters[key] = value;
        return query;
      },
      update: mutate,
      insert: mutate,
      delete: mutate,
      maybeSingle: async () => {
        const result = rows[table] ?? { data: null };
        const matches =
          result.data &&
          Object.entries(read.filters).every(([key, value]) => result.data![key] === value);
        return { data: matches ? result.data : null, error: result.error ?? null };
      },
    };
    return query;
  });
  return { admin: { from, rpc }, reads, mutate, rpc };
}

describe("verified Cloud status parsing", () => {
  it("leaves the existing connector boundary untouched without the Cloud workspace marker", () => {
    expect(verifiedCloudReceipt({}, providerStatus())).toBeNull();
    expect(
      verifiedCloudReceipt({ _verified_connection_id: connectionId }, { status: "read" }),
    ).toBeNull();
  });

  it("retains the exact sender, connection, wamid and canonical recipient from a verified status", () => {
    expect(verifiedCloudReceipt(cloudValue(), providerStatus())).toEqual(receipt());
    expect(
      verifiedCloudReceipt(cloudValue(), { ...providerStatus(), recipient_id: recipient }),
    ).toEqual(receipt());
  });

  it("keeps an absent connection marker unproven for historical queue rows", () => {
    const value: Record<string, unknown> = cloudValue();
    delete value._verified_connection_id;
    expect(verifiedCloudReceipt(value, providerStatus())).toMatchObject({ connectionId: null });
  });

  it.each([
    { _verified_workspace_id: "not-a-workspace" },
    { _verified_connection_id: "not-a-connection" },
    { metadata: {} },
    { metadata: { phone_number_id: "1234" } },
    { metadata: { phone_number_id: "123456/other" } },
  ])("rejects incomplete or malformed verified context: %j", (patch) => {
    expect(() => verifiedCloudReceipt({ ...cloudValue(), ...patch }, providerStatus())).toThrow(
      "Contexto verificado",
    );
  });

  it.each([
    { id: "" },
    { id: "wamid with whitespace" },
    { id: "x".repeat(513) },
    { recipient_id: undefined },
    { recipient_id: "415-555-2671" },
    { recipient_id: "++14155552671" },
    { status: "queued" },
    { status: undefined },
  ])("rejects unsupported status evidence: %j", (patch) => {
    expect(() => verifiedCloudReceipt(cloudValue(), { ...providerStatus(), ...patch })).toThrow(
      "Contexto verificado",
    );
  });

  it.each([131026, "131026", 131049, "131049"])(
    "extracts only a known failed-recipient code %s",
    (code) => {
      expect(
        verifiedCloudReceipt(cloudValue(), {
          ...providerStatus(),
          status: "failed",
          errors: [{ code }],
        }),
      ).toMatchObject({
        status: "failed",
        errorCode: String(code),
      });
    },
  );

  it.each(["sent", "accepted", "delivered", "read"])(
    "does not infer suppression from errors on a %s status",
    (status) => {
      expect(
        verifiedCloudReceipt(cloudValue(), {
          ...providerStatus(),
          status,
          errors: [{ code: 131026 }],
        }),
      ).toMatchObject({ errorCode: null });
    },
  );

  it.each(
    [
      undefined,
      [],
      [{ code: 131048 }],
      [{ title: "Error 131026" }],
      [{ code: 100, message: "Error 131049" }],
    ].map((errors) => ({ errors })),
  )("does not guess a recipient refusal from unsupported errors: %j", ({ errors }) => {
    expect(
      verifiedCloudReceipt(cloudValue(), { ...providerStatus(), status: "failed", errors }),
    ).toMatchObject({ errorCode: null });
  });
});

describe("Cloud receipt projection qualification", () => {
  it("checks the conversation in the same workspace before allowing its mapped sender", async () => {
    const { admin, reads, mutate } = fakeAdmin();
    await expect(
      assertCloudReceiptProjection(admin, receipt(), message()),
    ).resolves.toBeUndefined();
    expect(reads).toEqual([
      {
        table: "whatsapp_conversations",
        columns: "id,workspace_id,wa_phone_number_id",
        filters: { id: "synthetic-conversation", workspace_id: workspaceId },
      },
    ]);
    expect(mutate).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { workspace_id: otherId },
    { direction: "inbound" },
    { to_number: "+14155552672" },
    { to_number: null },
  ])(
    "rejects a different workspace, direction or recipient before any lookup or mutation: %j",
    async (patch) => {
      const { admin, mutate } = fakeAdmin();
      await expect(
        assertCloudReceiptProjection(admin, receipt(), { ...message(), ...patch }),
      ).rejects.toThrow("não corresponde");
      expect(admin.from).not.toHaveBeenCalled();
      expect(mutate).not.toHaveBeenCalled();
    },
  );

  it.each([
    { data: null },
    { data: { id: "synthetic-conversation", workspace_id: otherId, wa_phone_number_id: senderId } },
    {
      data: {
        id: "synthetic-conversation",
        workspace_id: workspaceId,
        wa_phone_number_id: "987654",
      },
    },
    { data: null, error: { message: "Read unavailable" } },
  ])("rejects a missing, foreign or wrong-sender conversation: %j", async (conversation) => {
    const { admin, mutate } = fakeAdmin({ whatsapp_conversations: conversation });
    await expect(assertCloudReceiptProjection(admin, receipt(), message())).rejects.toThrow(
      "remetente do recibo",
    );
    expect(mutate).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("rejects a mismatched pinned connection before consulting a mutable number mapping", async () => {
    const { admin, reads, mutate } = fakeAdmin();
    await expect(
      assertCloudReceiptProjection(admin, receipt(), {
        ...message(),
        raw: { source: { connection_id: otherId } },
      }),
    ).rejects.toThrow("conexão do recibo");
    expect(reads.map((read) => read.table)).toEqual(["whatsapp_conversations"]);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("uses a stored connection pin for historical receipts after the current mapping changes", async () => {
    const { admin, reads } = fakeAdmin({ wa_cloud_numbers: { data: null } });
    await expect(
      assertCloudReceiptProjection(admin, receipt(), message()),
    ).resolves.toBeUndefined();
    expect(reads.map((read) => read.table)).toEqual(["whatsapp_conversations"]);
  });

  it("requires a same-workspace, same-sender connection lookup for a legacy unpinned projection", async () => {
    const { admin, reads } = fakeAdmin();
    await expect(
      assertCloudReceiptProjection(admin, receipt(), { ...message(), raw: null }),
    ).resolves.toBeUndefined();
    expect(reads[1]).toEqual({
      table: "wa_cloud_numbers",
      columns: "connection_id",
      filters: { workspace_id: workspaceId, phone_number_id: senderId },
    });
  });

  it.each([
    { data: null },
    { data: { phone_number_id: senderId, workspace_id: workspaceId, connection_id: otherId } },
    { data: { phone_number_id: senderId, workspace_id: otherId, connection_id: connectionId } },
    { data: null, error: { message: "Read unavailable" } },
  ])("rejects an unprovable historical connection: %j", async (number) => {
    const { admin, mutate } = fakeAdmin({ wa_cloud_numbers: number });
    await expect(
      assertCloudReceiptProjection(admin, receipt(), { ...message(), raw: null }),
    ).rejects.toThrow("conexão histórica");
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("notification receipt ledger RPC", () => {
  it("forwards only the correlated receipt and the seventh allowlisted error argument", async () => {
    const { admin, rpc } = fakeAdmin();
    await expect(
      recordNotificationCloudReceipt(admin, {
        ...receipt(),
        status: "failed",
        errorCode: "131026",
      }),
    ).resolves.toEqual({ matched: true, updated: true });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("notification_whatsapp_receipt", {
      p_workspace: workspaceId,
      p_connection: connectionId,
      p_sender: senderId,
      p_wamid: "wamid.synthetic-receipt",
      p_recipient: recipient,
      p_status: "failed",
      p_error_code: "131026",
    });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("never invents a connection for an old queue row or calls the ledger without one", async () => {
    const { admin, rpc } = fakeAdmin();
    await expect(
      recordNotificationCloudReceipt(admin, { ...receipt(), connectionId: null }),
    ).resolves.toEqual({ matched: false, updated: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns unmatched or already-applied acknowledgements without fabricating a successful update", async () => {
    const { admin, rpc } = fakeAdmin();
    rpc.mockResolvedValueOnce({ data: { matched: false, updated: false }, error: null });
    rpc.mockResolvedValueOnce({ data: { matched: true, updated: false }, error: null });
    expect(await recordNotificationCloudReceipt(admin, receipt())).toEqual({
      matched: false,
      updated: false,
    });
    expect(await recordNotificationCloudReceipt(admin, receipt())).toEqual({
      matched: true,
      updated: false,
    });
  });

  it("propagates a persistence failure so the durable webhook queue can retry", async () => {
    const { admin, rpc } = fakeAdmin();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Receipt storage unavailable" } });
    await expect(recordNotificationCloudReceipt(admin, receipt())).rejects.toThrow(
      "Receipt storage unavailable",
    );
  });

  it.each([null, {}, { matched: true }, { matched: "true", updated: true }])(
    "rejects an invalid ledger result: %j",
    async (data) => {
      const { admin, rpc } = fakeAdmin();
      rpc.mockResolvedValueOnce({ data, error: null });
      await expect(recordNotificationCloudReceipt(admin, receipt())).rejects.toThrow();
    },
  );
});

describe("Cloud inbound enablement at durable queue retry", () => {
  it("preserves the existing connector path without a verified Cloud workspace", async () => {
    const { admin } = fakeAdmin();
    await expect(assertCloudInboundEnabled(admin, {})).resolves.toBeUndefined();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("permits inbound only after same-workspace number and enabled verified connection reads", async () => {
    const { admin, reads, mutate } = fakeAdmin();
    await expect(assertCloudInboundEnabled(admin, cloudValue())).resolves.toBeUndefined();
    expect(reads).toEqual([
      {
        table: "wa_cloud_numbers",
        columns: "connection_id,available",
        filters: { workspace_id: workspaceId, phone_number_id: senderId },
      },
      {
        table: "wa_cloud_connections",
        columns: "enabled,webhook_verified_at",
        filters: { id: connectionId, workspace_id: workspaceId },
      },
    ]);
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each([
    { data: null },
    {
      data: {
        phone_number_id: senderId,
        workspace_id: workspaceId,
        connection_id: connectionId,
        available: false,
      },
    },
    {
      data: {
        phone_number_id: senderId,
        workspace_id: workspaceId,
        connection_id: connectionId,
        available: null,
      },
    },
    {
      data: {
        phone_number_id: senderId,
        workspace_id: otherId,
        connection_id: connectionId,
        available: true,
      },
    },
    { data: null, error: { message: "Read unavailable" } },
  ])(
    "quarantines inbound with an unavailable or foreign number before loading a connection: %j",
    async (number) => {
      const { admin, reads, mutate } = fakeAdmin({ wa_cloud_numbers: number });
      await expect(assertCloudInboundEnabled(admin, cloudValue())).rejects.toThrow(
        "Número Cloud indisponível",
      );
      expect(reads.map((read) => read.table)).toEqual(["wa_cloud_numbers"]);
      expect(mutate).not.toHaveBeenCalled();
    },
  );

  it("quarantines queued inbound when its verified connection no longer matches the sender mapping", async () => {
    const { admin, reads } = fakeAdmin({
      wa_cloud_numbers: {
        data: {
          phone_number_id: senderId,
          workspace_id: workspaceId,
          connection_id: otherId,
          available: true,
        },
      },
    });
    await expect(assertCloudInboundEnabled(admin, cloudValue())).rejects.toThrow(
      "conexão Cloud da mensagem mudou",
    );
    expect(reads.map((read) => read.table)).toEqual(["wa_cloud_numbers"]);
  });

  it.each([
    { data: null },
    {
      data: {
        id: connectionId,
        workspace_id: workspaceId,
        enabled: false,
        webhook_verified_at: "verified",
      },
    },
    {
      data: {
        id: connectionId,
        workspace_id: workspaceId,
        enabled: true,
        webhook_verified_at: null,
      },
    },
    {
      data: {
        id: connectionId,
        workspace_id: otherId,
        enabled: true,
        webhook_verified_at: "verified",
      },
    },
    { data: null, error: { message: "Read unavailable" } },
  ])(
    "quarantines inbound while its connection is disabled, unverified or unprovable: %j",
    async (connection) => {
      const { admin, mutate } = fakeAdmin({ wa_cloud_connections: connection });
      await expect(assertCloudInboundEnabled(admin, cloudValue())).rejects.toThrow(
        "aguardando ativação",
      );
      expect(mutate).not.toHaveBeenCalled();
    },
  );
});
