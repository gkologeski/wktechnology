/** Delegate UI interaction only after the authenticated wrapper confirms its capability. */
export function notificationDeliveryInteractionAllowed(
  allowed: boolean | undefined,
  pending = false,
): boolean {
  return allowed === true && pending === false;
}
