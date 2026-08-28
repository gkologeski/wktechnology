/**
 * Entrega assíncrona de telefone revelado pela Apollo.io.
 *
 * Quando `reveal_phone_number` é usado com `webhook_url`, a Apollo entrega os
 * números depois da resposta do `people/match`. Este helper normaliza o payload
 * e grava o celular/telefone no lead/contato correspondente, sem sobrescrever
 * valores existentes.
 *
 * A correlação segue esta ordem (a Apollo não devolve o nosso id):
 *   1. `apollo_phone_reveals` por `apollo_person_id`;
 *   2. `apollo_phone_reveals` por `linkedin_url` normalizado;
 *   3. `apollo_phone_reveals` por e-mail;
 *   4. fallback histórico: `leads`/`contacts` por e-mail.
 *
 * Isso é o que permite receber o celular de leads sem e-mail (enriquecidos
 * apenas pelo perfil do LinkedIn).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { linkedinUrlOrNull } from "@/lib/prospecting/linkedin-url";

type ApolloWebhookPhone = { sanitized_number?: string; raw_number?: string; type?: string };

type ApolloWebhookPerson = {
  id?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: ApolloWebhookPhone[];
};

export type ApolloPhonePayload = {
  people?: ApolloWebhookPerson[];
  person?: ApolloWebhookPerson;
  /** Alguns webhooks entregam a pessoa dentro de `data`. */
  data?: { people?: ApolloWebhookPerson[]; person?: ApolloWebhookPerson };
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

type Target = { table: "leads" | "contacts"; id: string; revealId?: string };

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/** Localiza os registros que devem receber os números desta pessoa. */
async function resolveTargets(person: ApolloWebhookPerson): Promise<Target[]> {
  const supabase = supabaseAdmin;
  const email = person.email?.trim().toLowerCase() ?? null;
  const linkedin = linkedinUrlOrNull(person.linkedin_url);
  const personId = person.id?.trim() ?? null;

  const fromReveals = async (
    column: "apollo_person_id" | "linkedin_url" | "email",
    value: string,
  ) => {
    const { data } = await supabase
      .from("apollo_phone_reveals")
      .select("id, entity_type, entity_id")
      .eq(column, value)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    return ((data ?? []) as Array<{ id: string; entity_type: string; entity_id: string }>).map(
      (r): Target => ({
        table: r.entity_type === "contact" ? "contacts" : "leads",
        id: r.entity_id,
        revealId: r.id,
      }),
    );
  };

  const targets: Target[] = [];
  if (personId) targets.push(...(await fromReveals("apollo_person_id", personId)));
  if (!targets.length && linkedin) targets.push(...(await fromReveals("linkedin_url", linkedin)));
  if (!targets.length && email) targets.push(...(await fromReveals("email", email)));

  // Fallback histórico por e-mail (revelações pedidas antes deste registro).
  if (!targets.length && email) {
    for (const table of ["leads", "contacts"] as const) {
      const { data } = await supabase.from(table).select("id").ilike("email", email).limit(5);
      for (const row of (data ?? []) as Array<{ id: string }>) {
        targets.push({ table, id: row.id });
      }
    }
  }

  // Deduplica por tabela+id preservando o revealId encontrado.
  const seen = new Set<string>();
  return targets.filter((t) => {
    const key = `${t.table}:${t.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Aplica os números recebidos; devolve quantos registros foram atualizados. */
export async function applyApolloPhonePayload(payload: ApolloPhonePayload): Promise<number> {
  const people: ApolloWebhookPerson[] =
    payload.people ??
    (payload.person ? [payload.person] : null) ??
    payload.data?.people ??
    (payload.data?.person ? [payload.data.person] : []);
  if (!people.length) return 0;

  const supabase = supabaseAdmin;
  let updated = 0;

  for (const person of people) {
    const { mobile, work } = splitNumbers(person.phone_numbers);
    const targets = await resolveTargets(person);

    if (!mobile && !work) {
      // Sem números: encerra as revelações pendentes para não ficarem penduradas.
      for (const t of targets) {
        if (!t.revealId) continue;
        await supabase
          .from("apollo_phone_reveals")
          .update({ status: "empty", applied_at: new Date().toISOString() })
          .eq("id", t.revealId);
      }
      continue;
    }

    for (const target of targets) {
      const { data: row } = await supabase
        .from(target.table)
        .select("id, phone, mobile_phone")
        .eq("id", target.id)
        .maybeSingle();
      const current = row as { phone?: unknown; mobile_phone?: unknown } | null;
      if (current) {
        const patch: Record<string, unknown> = {};
        if (mobile && isEmpty(current.mobile_phone)) patch.mobile_phone = mobile;
        // Celular tem prioridade no campo principal quando ele está vazio.
        if (isEmpty(current.phone) && (mobile ?? work)) patch.phone = mobile ?? work;
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase
            .from(target.table)
            .update(patch as never)
            .eq("id", target.id);
          if (!error) updated += 1;
        }
      }

      if (target.revealId) {
        await supabase
          .from("apollo_phone_reveals")
          .update({
            status: "applied",
            mobile_phone: mobile,
            work_phone: work,
            applied_at: new Date().toISOString(),
            apollo_person_id: person.id?.trim() ?? null,
          })
          .eq("id", target.revealId);
      }
    }
  }

  return updated;
}
