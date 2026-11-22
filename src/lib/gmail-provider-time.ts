/** Gmail internalDate is provider-confirmed epoch milliseconds; absence is not a clock fallback. */
function requireGmailProviderDate(value: string | undefined): Date {
  if (!value || !/^\d{1,16}$/.test(value))
    throw new Error("Data do provedor Gmail ausente ou inválida.");
  const milliseconds = Number(value);
  const date = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || Number.isNaN(date.getTime()))
    throw new Error("Data do provedor Gmail inválida.");
  return date;
}
export function gmailProviderTime(value: string | undefined): string {
  return requireGmailProviderDate(value).toISOString();
}
