/** Shared by saveWorkflow and PostgreSQL lifecycle tests; no live version write. */
type DraftInput = {
  name: string;
  entity: string;
  enabled: boolean;
  trigger: { event?: unknown; notification_event?: unknown; goal_filters?: unknown };
  actions: unknown;
};

export function workflowDraftFields<T extends DraftInput>(
  data: T,
): {
  name: string;
  entity: string;
  enabled: boolean;
  draft_trigger: T["trigger"];
  draft_actions: T["actions"];
  draft_goal_filters: unknown;
} {
  return {
    name: data.name,
    entity: data.entity,
    enabled: data.enabled,
    draft_trigger: data.trigger,
    draft_actions: data.actions,
    draft_goal_filters: data.trigger.goal_filters ?? [],
  };
}

export function workflowDraftInsert<T extends DraftInput>(
  data: T,
  owner: string,
  workspace: string,
) {
  return {
    ...workflowDraftFields(data),
    // An Inbox live placeholder must never be enabled before publication.
    enabled: data.entity === "inbox_channel_occurrences" ? false : data.enabled,
    workspace_id: workspace,
    owner_id: owner,
    status: "draft",
    trigger: {},
    actions: [],
    goal_filters: [],
  };
}
