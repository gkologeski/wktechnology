import { describe, expect, it, vi } from "vitest";
import { sendWorkflowEmail } from "./workflow-email.server";

type Tables = Record<string, Record<string, unknown>[]>;

function fakeDb(tables: Tables) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let pendingInsert: Record<string, unknown> | null = null;
    const rows = () =>
      (tables[table] ?? []).filter((r) =>
        filters.every(([k, v]) => {
          if (k === "headers->>x-wf-idempotency")
            return (r.headers as Record<string, unknown> | undefined)?.["x-wf-idempotency"] === v;
          return String(r[k]).toLowerCase() === String(v).toLowerCase();
        }),
      );
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      ilike: (k: string, v: unknown) => (filters.push([k, v]), q),
      order: () => q,
      limit: () => Promise.resolve({ data: rows(), error: null }),
      insert: (row: Record<string, unknown>) => {
        pendingInsert = { id: `m${inserts.length + 1}`, ...row };
        inserts.push({ table, row: pendingInsert });
        (tables[table] ??= []).push(pendingInsert);
        return q;
      },
      maybeSingle: () => Promise.resolve({ data: pendingInsert, error: null }),
    };
    return q;
  };
  return { db: { from } as never, inserts };
}

const base = { workspaceId: "wk", ownerId: "u1", runId: "r1", to: "Ana@x.com", subject: "Oi", bodyHtml: "<p>Olá</p>" };
const account = { id: "acc", workspace_id: "wk", owner_id: "u1", provider: "gmail", status: "connected", email: "eu@wk.com" };

describe("sendWorkflowEmail", () => {
  it("envia pela caixa Gmail do dono no mesmo workspace", async () => {
    const { db, inserts } = fakeDb({ email_accounts: [account] });
    const send = vi.fn().mockResolvedValue({ id: "g1", threadId: "t1" });
    const r = await sendWorkflowEmail(db, base, { send });
    expect(r).toMatchObject({ status: "sent", provider: "gmail", providerId: "g1" });
    expect(send).toHaveBeenCalledOnce();
    expect(inserts[0].row.provider_message_id).toBe("g1");
  });
  it("não envia duas vezes na mesma execução", async () => {
    const { db } = fakeDb({ email_accounts: [account] });
    const send = vi.fn().mockResolvedValue({ id: "g1", threadId: "t1" });
    await sendWorkflowEmail(db, base, { send });
    const r = await sendWorkflowEmail(db, base, { send });
    expect(r.status).toBe("skipped_duplicate");
    expect(send).toHaveBeenCalledOnce();
  });
  it("respeita descadastro", async () => {
    const { db } = fakeDb({ email_accounts: [account], email_unsubscribes: [{ workspace_id: "wk", email: "ana@x.com" }] });
    const send = vi.fn();
    expect((await sendWorkflowEmail(db, base, { send })).status).toBe("unsubscribed");
    expect(send).not.toHaveBeenCalled();
  });
  it("caixa de outro workspace não é usada: fica na fila interna", async () => {
    const { db } = fakeDb({ email_accounts: [{ ...account, workspace_id: "outro" }] });
    const send = vi.fn();
    expect((await sendWorkflowEmail(db, base, { send })).status).toBe("queued_local");
    expect(send).not.toHaveBeenCalled();
  });
});
