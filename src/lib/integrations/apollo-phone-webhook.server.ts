/**
 * Entrega assíncrona de telefone revelado pela Apollo.io.
 *
 * Quando `reveal_phone_number` é usado com `webhook_url`, a Apollo entrega os
 * números depois da resposta do `people/match`. Este helper normaliza o payload
 * e grava o celular/telefone no lead e no contato correspondentes (match por
 * e-mail ou pelo id externo da Apollo), sem sobrescrever valores existentes.
 */
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";

type ApolloWebhookPhone = { sanitized_number?: string; raw_number?: string; type?: string };

export type ApolloPhonePayload = {
  people?: Array<{
    id?: string | null;
    email?: string | null;
    phone_numbers?: ApolloWebhookPhone[];
  }>;
  person?: {
    id?: string | null;
    email?: string | null;
    phone_numbers?: ApolloWebhookPhone[];
  };
};

function splitNumbers(numbers: ApolloWebhookPhone[] | undefined) {
  const list = numbers ?? [];
  const isMobile = (n: ApolloWebhookPhone) => (n.type ?? "").toLowerCase().includes("mobile");
  const num = (n?: ApolloWebhookPhone) => n?.sanitized_number ?? n?.raw_number ?? null;
  return {
    mobile: num(list.find(isMobile)),
    work: num(list.find((n) => !isMobile(n))) ?? num(list[0]),
  };
}

type Row = Record<string, unknown> & { id: string };

/** Aplica os números recebidos; devolve quantos registros foram atualizados. */
export async function applyApolloPhonePayload(payload: ApolloPhonePayload): Promise<number> {
  const people = payload.people ?? (payload.person ? [payload.person] : []);
  if (!people.length) return 0;

  const supabase = getSupabaseAdmin();
  let updated = 0;

  for (const person of people) {
    const { mobile, work } = splitNumbers(person.phone_numbers);
    if (!mobile && !work) continue;
    const email = person.email?.trim().toLowerCase() ?? null;
    if (!email) continue;

    for (const table of ["leads", "contacts"] as const) {
      const { data } = await supabase
        .from(table)
        .select("id, phone, mobile_phone")
        .ilike("email", email)
        .limit(5);
      for (const row of (data ?? []) as unknown as Row[]) {
        const patch: Record<string, unknown> = {};
        const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
        if (mobile && isEmpty(row.mobile_phone)) patch.mobile_phone = mobile;
        // Celular tem prioridade no campo principal quando ele está vazio.
        if (isEmpty(row.phone) && (mobile ?? work)) patch.phone = mobile ?? work;
        if (Object.keys(patch).length === 0) continue;
        const { error } = await supabase
          .from(table)
          .update(patch as never)
          .eq("id", row.id);
        if (!error) updated += 1;
      }
    }
  }

  return updated;
}
