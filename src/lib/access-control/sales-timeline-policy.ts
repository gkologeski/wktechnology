/** UI affordance. Server and DB independently validate the action and record. */
export function timelineActionResource(kind: "log" | "create", value: string): string | null {
  if (kind === "log")
    return value === "note"
      ? "techsales.notes"
      : value === "task"
        ? "techsales.tasks"
        : "techsales.activities";
  return (
    (
      {
        email: "techsales.inbox.email",
        whatsapp: "techsales.inbox.whatsapp",
        call: "techsales.prospecting_voice",
        meeting: "techsales.meetings",
        sequence: "system.automation.sequences",
        linkedin: "system.linkedin",
      } as Record<string, string>
    )[value] ?? null
  );
}
export function canCreateTimelineAction(
  keys: ReadonlySet<string>,
  kind: "log" | "create",
  value: string,
  readOnly: boolean,
) {
  const r = timelineActionResource(kind, value);
  return (
    !!r &&
    !readOnly &&
    ["own", "team", "workspace"].some((s) => keys.has(`${r}.view.${s}`)) &&
    ["own", "team", "workspace"].some((s) => keys.has(`${r}.create.${s}`))
  );
}
