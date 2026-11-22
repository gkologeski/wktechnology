import assert from "node:assert/strict";
import { INBOX_CHANNEL_EVENT_KEYS } from "../../../src/lib/workflows/inbox-channel-events";
import type { ChatApi } from "./chat-response-checks";

/** Actual producer occurrence IDs, not fabricated envelopes or row snapshots. */
export async function checkThirteenReadBoundaries(
  api: ChatApi,
  occurrences: ReadonlyMap<string, string>,
  tokens: ReadonlyMap<number, string>,
) {
  assert.deepEqual([...occurrences.keys()].sort(), [...INBOX_CHANNEL_EVENT_KEYS].sort());
  let checks = 0;
  for (const key of INBOX_CHANNEL_EVENT_KEYS) {
    const id = occurrences.get(key);
    assert.ok(id, `Missing real producer for ${key}`);
    for (const n of [11, 12, 13, 14, 15]) {
      const token = tokens.get(n);
      assert.ok(token, `Missing real GoTrue session ${n}`);
      const rows = await api(
        `/rest/v1/inbox_channel_occurrences?id=eq.${id}&select=id,event_key`,
        "GET",
        undefined,
        token,
      );
      assert.equal(rows.status, 200);
      assert.ok(Array.isArray(rows.body));
      assert.equal(rows.body.length, n === 11 ? 1 : 0, `${key}, profile ${n}`);
      const reference = await api(
        "/rest/v1/rpc/sales_event_reference_access",
        "POST",
        { e: "inbox_channel_occurrences", i: id },
        token,
      );
      assert.equal(reference.status, 200);
      assert.equal(reference.body, n === 11, `${key}, authenticated reference ${n}`);
      const privateReceipts = await api(
        "/rest/v1/inbox_response_receipts?select=id",
        "GET",
        undefined,
        token,
      );
      assert.equal(privateReceipts.status, 403);
      checks += 3;
    }
  }
  return checks;
}
