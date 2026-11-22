import assert from "node:assert/strict";
export type ChatApi = (
  path: string,
  method: string,
  body?: unknown,
  token?: string,
) => Promise<{ status: number; body: unknown }>;

/** Run with real GoTrue tokens against the caller-owned disposable catalogue. */
export async function checkChatResponses(
  api: ChatApi,
  workspace: string,
  user: (n: number) => string,
  tokens: Map<number, string>,
) {
  let checks = 0;
  const token = (n: number) => {
    const t = tokens.get(n);
    assert.ok(t);
    return t;
  };
  const newSession = async (assignee: number) => {
    const id = crypto.randomUUID();
    assert.equal(
      (
        await api("/rest/v1/live_chat_sessions", "POST", {
          id,
          workspace_id: workspace,
          owner_id: workspace,
          assignee_id: user(assignee),
          visitor_id: id,
          status: "open",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api("/rest/v1/rpc/widget_inbound_commit", "POST", {
          p_session: id,
          p_visitor: id,
          p_request: crypto.randomUUID(),
          p_body: "Canonical visitor input",
        })
      ).status,
      200,
    );
    return id;
  };
  const count = async (session: string) => {
    const r = await api(
      `/rest/v1/inbox_channel_occurrences?conversation_id=eq.${session}&event_key=eq.shared.chat.first_response&select=id`,
      "GET",
    );
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    return r.body.length;
  };
  const payload = (session: string, n: number) => {
    const request = crypto.randomUUID();
    return {
      id: request,
      inbox_chat_request: request,
      workspace_id: workspace,
      owner_id: workspace,
      session_id: session,
      direction: "outbound",
      author_user_id: user(n),
      body: "Confirmed user/RLS chat",
    };
  };
  const own = await newSession(16),
    peer = await newSession(18),
    outside = await newSession(19);
  // The broadened view.workspace is intentional: create scope must still limit INSERT.
  for (const [n, session, allowed] of [
    [16, own, true],
    [16, peer, false],
    [17, peer, true],
    [17, outside, false],
    [11, outside, true],
    [12, outside, false],
    [13, outside, false],
    [14, outside, false],
    [15, outside, false],
  ] as const) {
    const r = await api("/rest/v1/live_chat_messages", "POST", payload(session, n), token(n));
    assert.equal(r.status, allowed ? 201 : 403, `real INSERT scope profile ${n}`);
    checks++;
  }
  assert.equal(await count(own), 1);
  assert.equal(await count(peer), 1);
  assert.equal(await count(outside), 1);
  checks += 3;
  const second = payload(own, 16);
  assert.equal((await api("/rest/v1/live_chat_messages", "POST", second, token(16))).status, 201);
  assert.equal((await api("/rest/v1/live_chat_messages", "POST", second, token(16))).status, 409);
  assert.equal(await count(own), 1);
  checks += 3;
  assert.equal(
    (
      await api(`/rest/v1/live_chat_messages?id=eq.${second.id}`, "PATCH", {
        inbox_chat_request: crypto.randomUUID(),
      })
    ).status,
    403,
  );
  checks++;
  const unproved = await newSession(11);
  const mirror = { ...payload(unproved, 11), inbox_chat_request: null };
  assert.equal((await api("/rest/v1/live_chat_messages", "POST", mirror, token(11))).status, 201);
  assert.equal(await count(unproved), 0);
  checks += 2;
  assert.equal(
    (
      await api(`/rest/v1/live_chat_messages?id=eq.${mirror.id}`, "PATCH", {
        inbox_chat_request: mirror.id,
      })
    ).status,
    403,
  );
  checks++;
  const spoof = { ...payload(unproved, 11), author_user_id: user(16) };
  assert.equal((await api("/rest/v1/live_chat_messages", "POST", spoof, token(11))).status, 403);
  checks++;
  assert.equal(
    (await api("/rest/v1/live_chat_messages", "POST", payload(unproved, 11))).status,
    403,
  );
  checks++;
  for (const n of [11, 12, 13, 14, 15]) {
    assert.equal(
      (
        await api(
          "/rest/v1/rpc/inbox_chat_outbound_commit",
          "POST",
          {
            p_workspace: workspace,
            p_actor: user(n),
            p_session: unproved,
            p_request: crypto.randomUUID(),
            p_body: "No admin bypass",
          },
          token(n),
        )
      ).status,
      403,
    );
    checks++;
  }
  assert.equal(
    (
      await api("/rest/v1/rpc/inbox_chat_outbound_commit", "POST", {
        p_workspace: workspace,
        p_actor: user(11),
        p_session: unproved,
        p_request: crypto.randomUUID(),
        p_body: "No admin bypass",
      })
    ).status,
    403,
  );
  checks++;
  const historical = await newSession(11);
  assert.equal(
    (
      await api("/rest/v1/live_chat_messages", "POST", {
        ...payload(historical, 11),
        inbox_chat_request: null,
        created_at: "2000-01-01T00:00:00Z",
      })
    ).status,
    201,
  );
  assert.equal(
    (await api("/rest/v1/live_chat_messages", "POST", payload(historical, 11), token(11))).status,
    201,
  );
  assert.equal(await count(historical), 0);
  checks += 3;
  // Two independent real message INSERTs race for one conversation claim.
  const raced = await newSession(11);
  const race = await Promise.all([
    api("/rest/v1/live_chat_messages", "POST", payload(raced, 11), token(11)),
    api("/rest/v1/live_chat_messages", "POST", payload(raced, 11), token(11)),
  ]);
  assert.deepEqual(
    race.map((r) => r.status),
    [201, 201],
  );
  assert.equal(await count(raced), 1);
  checks += 2;
  return checks;
}
