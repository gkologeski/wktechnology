/* eslint-disable @typescript-eslint/no-explicit-any */
type DbError = { message: string; code?: string } | null;

/**
 * A contact can be tied to a deal through a `deal_contacts` row, through
 * `deals.primary_contact_id`, or both. Only the links that actually exist are
 * removed, so a primary-only contact does not trip the zero-row denial of the
 * checked writer.
 *
 * `reader` is the plain client (RLS reads); `writer` is the checked mutation
 * client, which reports zero-row writes as permission errors.
 */
export async function unlinkDealContact(
  reader: any,
  writer: any,
  dealId: string,
  contactId: string,
): Promise<{ error: DbError }> {
  const [linkRes, dealRes] = await Promise.all([
    reader
      .from("deal_contacts")
      .select("contact_id")
      .eq("deal_id", dealId)
      .eq("contact_id", contactId)
      .limit(1),
    reader.from("deals").select("primary_contact_id").eq("id", dealId).maybeSingle(),
  ]);
  if (linkRes.error) return { error: linkRes.error };
  if (dealRes.error) return { error: dealRes.error };

  const hasLink = Array.isArray(linkRes.data) && linkRes.data.length > 0;
  const isPrimary =
    (dealRes.data as { primary_contact_id?: string | null } | null)?.primary_contact_id ===
    contactId;

  if (hasLink) {
    const { error } = await writer
      .from("deal_contacts")
      .delete()
      .eq("deal_id", dealId)
      .eq("contact_id", contactId);
    if (error) return { error };
  }
  if (isPrimary) {
    const { error } = await writer
      .from("deals")
      .update({ primary_contact_id: null })
      .eq("id", dealId);
    if (error) return { error };
  }
  return { error: null };
}
