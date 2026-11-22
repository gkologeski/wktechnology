import { expect, it } from "vitest";
import { workflowDraftInsert } from "./draft-payload";

it("Inbox starts inactive with empty live config and the real draft intact", () => {
  const trigger = {
    event: "updated",
    notification_event: { key: "shared.chat.message_received", account_ids: [] },
  };
  const actions = [{ type: "notify", title: "Aviso" }];
  expect(
    workflowDraftInsert(
      { name: "Teste", entity: "inbox_channel_occurrences", enabled: true, trigger, actions },
      "actor",
      "workspace",
    ),
  ).toEqual({
    name: "Teste",
    entity: "inbox_channel_occurrences",
    enabled: false,
    workspace_id: "workspace",
    owner_id: "actor",
    status: "draft",
    trigger: {},
    actions: [],
    goal_filters: [],
    draft_trigger: trigger,
    draft_actions: actions,
    draft_goal_filters: [],
  });
});

it("WhatsApp and older entities retain the requested enabled value", () => {
  for (const entity of ["whatsapp_messages", "deals", "projects"]) {
    expect(
      workflowDraftInsert(
        { name: "Teste", entity, enabled: true, trigger: {}, actions: [] },
        "actor",
        "workspace",
      ).enabled,
    ).toBe(true);
  }
});
