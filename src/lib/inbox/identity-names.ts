export type IdentityNameRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export function personName(row?: IdentityNameRow | null): string | null {
  if (!row) return null;
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email?.trim() || null;
}

/** Nome exibido: Contato > Lead > telefone. */
export function conversationDisplayName(
  conv: { contact_id?: string | null; lead_id?: string | null; contact_phone: string },
  contacts: Map<string, string>,
  leads: Map<string, string>,
): string {
  return (
    (conv.contact_id && contacts.get(conv.contact_id)) ||
    (conv.lead_id && leads.get(conv.lead_id)) ||
    conv.contact_phone
  );
}
