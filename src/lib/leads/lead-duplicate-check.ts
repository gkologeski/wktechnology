import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = SupabaseClient<Database, "public", any>;

export type DuplicateCheckResult = {
  duplicate: boolean;
  field: "email" | "phone" | null;
  existingId: string | null;
  message: string | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const v = typeof email === "string" ? email.trim().toLowerCase() : "";
  return v || null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  const v = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  return v || null;
}

/**
 * Verifica se já existe um lead ativo com o mesmo e-mail ou telefone.
 *
 * Quando `workspaceId` é omitido, a query depende do RLS do cliente autenticado
 * para restringir ao workspace ativo. Use `workspaceId` quando o cliente for
 * administrativo (service role) ou não estiver sujeito a RLS de workspace.
 */
export async function checkLeadDuplicate(
  client: AnySupabase,
  input: {
    workspaceId?: string | null;
    email?: string | null;
    phone?: string | null;
    excludeId?: string | null;
  },
): Promise<DuplicateCheckResult> {
  const { workspaceId, excludeId } = input;
  const email = normalizeEmail(input.email);
  const phoneDigits = normalizePhone(input.phone);

  if (!email && !phoneDigits) {
    return { duplicate: false, field: null, existingId: null, message: null };
  }

  const base = () => {
    let q = client.from("leads").select("id, email, phone").is("deleted_at", null);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    if (excludeId) q = q.neq("id", excludeId);
    return q;
  };

  // E-mail resolve no banco (case-insensitive), sem trazer a base inteira.
  if (email) {
    const { data, error } = await base().ilike("email", email).limit(1);
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0];
    if (row) {
      return {
        duplicate: true,
        field: "email",
        existingId: row.id,
        message: `Já existe um lead com o e-mail ${input.email?.trim() ?? ""} neste workspace.`,
      };
    }
  }

  // Telefone é gravado com máscaras variadas; a coluna gerada `phone_digits`
  // (índice por workspace) resolve a comparação normalizada no banco, em uma
  // única consulta — sem varrer a base inteira pela rede.
  if (phoneDigits) {
    const { data, error } = await base().eq("phone_digits", phoneDigits).limit(1);
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0];
    if (row) {
      return {
        duplicate: true,
        field: "phone",
        existingId: row.id,
        message: `Já existe um lead com o telefone ${input.phone?.trim() ?? ""} neste workspace.`,
      };
    }
  }

  return { duplicate: false, field: null, existingId: null, message: null };
}
