/** Untrusted callback pointers never grant access; the authenticated server verifies them. */
export function linkedinCallbackTarget(search: Record<string, unknown>) {
  const ok = validCallbackPointer(search);
  const query = new URLSearchParams({ connected: ok ? "1" : "0" });
  if (ok) {
    query.set("state", search.state as string);
    query.set("account_id", search.account_id as string);
  }
  return { ok, target: `/settings/integrations/linkedin?${query}` };
}

function validCallbackPointer(search: Record<string, unknown>) {
  return (
    !search.error_type &&
    typeof search.account_id === "string" &&
    search.account_id.length > 0 &&
    search.account_id.length <= 200 &&
    typeof search.state === "string" &&
    /^[a-f0-9]{64}$/.test(search.state)
  );
}
