/** Ephemeral composition state only. The server remains the sole authority for
 * account access, transport reservation, acceptance and uncertain delivery. */
export function createMessageSendAttempt(makeId = () => crypto.randomUUID()) {
  let current: { payload: string; id: string } | undefined;
  return {
    prepare<T extends Record<string, unknown>>(scope: readonly unknown[], data: T) {
      const payload = JSON.stringify([scope, data]);
      if (!current || current.payload !== payload) current = { payload, id: makeId() };
      return { ...data, request_id: current.id };
    },
    complete() {
      current = undefined;
    },
  };
}
