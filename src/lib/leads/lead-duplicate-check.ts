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

  // Telefone é gravado com máscaras variadas, então a comparação por dígitos
  // acontece em memória — mas paginando, porque a API corta a resposta em 1.000.
  if (phoneDigits) {
    const PAGE = 1000;
    for (let page = 0; page < 200; page += 1) {
      const from = page * PAGE;
      const { data, error } = await base()
        .not("phone", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      for (const row of rows) {
        if (normalizePhone(row.phone) === phoneDigits) {
          return {
            duplicate: true,
            field: "phone",
            existingId: row.id,
            message: `Já existe um lead com o telefone ${input.phone?.trim() ?? ""} neste workspace.`,
          };
        }
      }
      if (rows.length < PAGE) break;
    }
  }

  return { duplicate: false, field: null, existingId: null, message: null };
}
