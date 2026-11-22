import assert from "node:assert/strict";

/** Caller/ACL isolation only. This is NOT the executor/recipient acceptance matrix. */
export async function checkInboxDispatchCaller(
  call: (
    name: string,
    body: Record<string, unknown>,
  ) => Promise<{
    status: number;
    value: unknown;
  }>,
  scope: { workspace: string; workflow: string; run: string; occurrence: string },
  effects: () => Promise<number[]>,
) {
  const before = await effects();
  const body = {
    p_workflow: scope.workflow,
    p_run: scope.run,
    p_version: 1,
    p_entity: "inbox_channel_occurrences",
    p_record: scope.occurrence,
    p_rules: [{ kind: "source_responsible" }],
    p_title: "Teste descartável de isolamento do motor",
    p_body: null,
    p_step: "1",
  };
  for (const [name, input] of [
    ["notification_workflow_dispatch", body],
    [
      "notification_workflow_dispatch_v2",
      {
        ...body,
        p_delivery: { channels: ["inapp"], fallback: "none" },
      },
    ],
    [
      "notification_workflow_slack_dispatch",
      {
        p_workspace: scope.workspace,
        p_workflow: scope.workflow,
        p_run: scope.run,
        p_step_path: "1",
        p_version: 1,
      },
    ],
  ] as const) {
    const result = await call(name, input);
    assert.equal(result.status, 403, `${name} must reject a user session at its ACL`);
    const error = result.value;
    assert.ok(error && typeof error === "object" && "code" in error && "message" in error);
    assert.equal(error.code, "42501");
    assert.equal(typeof error.message, "string");
    assert.ok(
      String(error.message).includes(`permission denied for function ${name}`),
      "A missing workflow/proof is not evidence of caller isolation",
    );
    assert.deepEqual(await effects(), before, `${name} must create no business effects`);
  }
}
