import assert from "node:assert/strict";
import { workflowDraftInsert } from "../../../src/lib/workflows/draft-payload";

export type GuardResponse = { status: number; body: unknown };
export type GuardCall = (
  actor: number | null,
  method: string,
  path: string,
  body?: unknown,
) => Promise<GuardResponse>;
export async function checkInboxWorkflowGuard(
  call: GuardCall,
  workspace: string,
  user: (n: number) => string,
  released: boolean,
) {
  let checks = 0;
  const actions = [
    {
      type: "notify",
      title: "Atualização disponível",
      recipients: [{ kind: "source_responsible" }],
      delivery: { channels: ["inapp"], fallback: "none" },
    },
  ];
  const read = async (id: string) => {
    const r = await call(null, "GET", `/workflows?id=eq.${id}&select=*`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    return r.body as Array<Record<string, unknown>>;
  };
  for (const channel of ["email", "chat", "linkedin"]) {
    for (const selection of [{}, { account_ids: [] }]) {
      const trigger = {
        event: "updated",
        notification_event: { key: `shared.${channel}.message_received`, channel, ...selection },
      };
      for (const [actor, allowed] of [
        [11, true],
        [12, false],
        [13, false],
        [14, false],
        [15, false],
      ] as const) {
        const id = crypto.randomUUID();
        const payload = {
          id,
          ...workflowDraftInsert(
            {
              name: "Guard disposable",
              entity: "inbox_channel_occurrences",
              enabled: true,
              trigger,
              actions,
            },
            user(actor),
            workspace,
          ),
        };
        const r = await call(actor, "POST", "/workflows", payload);
        assert.equal(
          r.status,
          allowed ? 201 : 403,
          `create ${channel}/${actor}/${JSON.stringify(selection)}`,
        );
        assert.equal((await read(id)).length, allowed ? 1 : 0, "failed create is atomic");
        checks++;
        // Publication is attempted on a real authorized draft, not an already published fixture.
        const publishId = crypto.randomUUID();
        assert.equal(
          (await call(11, "POST", "/workflows", { ...payload, id: publishId, owner_id: user(11) }))
            .status,
          201,
        );
        const before = await read(publishId);
        const published = await call(actor, "PATCH", `/workflows?id=eq.${publishId}`, {
          trigger,
          actions,
          status: "published",
          published_version: 1,
          execution_user_id: user(actor),
        });
        const after = await read(publishId);
        if (allowed && released) {
          assert.equal(published.status, 200);
          assert.equal(after[0]?.["status"], "published");
        } else {
          assert.deepEqual(
            after,
            before,
            "failed publish must be atomic, including RLS-hidden rows",
          );
          if (allowed) {
            assert.equal(published.status, 403);
            assert.ok(
              typeof published.body === "object" &&
                published.body !== null &&
                "message" in published.body,
            );
            assert.match(String(published.body.message), /Gatilhos multicanal ainda em revisão/);
          }
        }
        checks++;
      }
    }
  }
  return checks;
}
