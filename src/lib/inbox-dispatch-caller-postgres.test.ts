import { beforeEach, it } from "vitest";
import {
  db,
  W,
  U,
  C,
  N,
  F,
  ROLE,
  WF,
  RUN,
  X,
  reset,
  request,
} from "../../tests/fixtures/notification-deliveries";
import { checkInboxDispatchCaller } from "../../tests/fixtures/inbox/dispatch-caller";

// Portable, disposable PostgreSQL/PostgREST tests in the mandatory Vitest suite.
// The existing fixture owns its Docker endpoints and verifies signed test JWTs.
// Five real GoTrue sessions execute the same contract in inbox-central-local.ts.
// These are caller isolation tests, not positive multichannel dispatch evidence.
beforeEach(reset);

async function check(actor: string) {
  await checkInboxDispatchCaller(
    async (name, body) => {
      const result = await request(`/rpc/${name}`, body, actor);
      return { status: result.status, value: result.payload as unknown };
    },
    { workspace: W, workflow: WF, run: RUN, occurrence: X },
    async () => {
      const [counts] = await db`select
        (select count(*)::int from notifications) notices,
        (select count(*)::int from notification_delivery_intents) intents,
        (select count(*)::int from notification_slack_intents) slack,
        (select count(*)::int from workflow_deliveries) deliveries`;
      if (!counts) throw new Error("Missing effect counts");
      return [counts["notices"], counts["intents"], counts["slack"], counts["deliveries"]];
    },
  );
}

it("Inbox permitted reader cannot invoke any of the three engine dispatch RPCs", async () => {
  await check(U);
});
it("Inbox missing-key reader cannot invoke any of the three engine dispatch RPCs", async () => {
  await check(N);
});
it("Inbox explicit-deny reader cannot invoke any of the three engine dispatch RPCs", async () => {
  await db`update job_role_permission_overrides set effect='deny'
    where workspace_id=${W} and role_id=${ROLE} and permission_key='techsales.inbox.email.view.workspace'`;
  await check(C);
});
it("Inbox other-workspace reader cannot invoke any of the three engine dispatch RPCs", async () => {
  await check(F);
});
it("Inbox inactive reader cannot invoke any of the three engine dispatch RPCs", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await check(U);
});
