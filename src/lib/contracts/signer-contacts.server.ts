import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { contractSignersSchema } from "./signers";
import { emailSchema } from "@/lib/email-schema";
/** Resolve identities through the caller/RLS, never caller-supplied names or addresses. */
export async function resolveSignerContacts(
  sb: SupabaseClient,
  userId: string,
  workspaceId: string,
  input: { role: string; contactId: string }[],
) {
  const signers = contractSignersSchema.parse(input);
  await assertAnyPermission(
    sb,
    userId,
    workspaceId,
    ["own", "team", "workspace"].map((s) => `techsales.contacts.view.${s}`),
  );
  const { data, error } = await sb
    .from("contacts")
    .select("id,first_name,last_name,email")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .in(
      "id",
      signers.map((s) => s.contactId),
    );
  if (error || !data || data.length !== signers.length)
    throw new Error("Um contato não está mais disponível. Pesquise e selecione novamente.");
  const result = signers.map((s) => {
    const c = data.find((c) => c.id === s.contactId)!;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    if (name.length < 2) throw new Error("Atualize o nome do contato.");
    return { ...s, name, email: emailSchema(255).parse(c.email) };
  });
  if (new Set(result.map((s) => s.email.toLowerCase())).size !== result.length)
    throw new Error("Os signatários precisam ter e-mails distintos.");
  return result;
}
