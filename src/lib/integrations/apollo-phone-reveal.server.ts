/**
 * Registro das revelações de telefone pedidas à Apollo.io.
 *
 * A Apollo entrega o número **depois** da resposta do `people/match`, via
 * webhook. Como o payload dela não carrega o nosso id, guardamos aqui a
 * intenção ("pedi o telefone desta pessoa para este lead/contato") com as
 * chaves de correlação possíveis: id da pessoa na Apollo, LinkedIn
 * normalizado e e-mail. O webhook (`apollo-phone-webhook.server.ts`) usa este
 * registro para gravar o celular no destino correto — inclusive quando o lead
 * não tem e-mail.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { linkedinUrlOrNull } from "@/lib/prospecting/linkedin-url";

export type ApolloRevealTarget = {
  workspaceId: string;
  entityType: "lead" | "contact";
  entityId: string;
};

export type ApolloRevealKeys = {
  apolloPersonId?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  signal?: string | null;
};

/**
 * Cria (ou reaproveita) as revelações pendentes para os destinos informados.
 * Devolve quantos registros ficaram pendentes de entrega.
 */
export async function registerApolloPhoneReveals(
  targets: ApolloRevealTarget[],
  keys: ApolloRevealKeys,
): Promise<number> {
  const apolloPersonId = keys.apolloPersonId?.trim() || null;
  const linkedinUrl = linkedinUrlOrNull(keys.linkedinUrl);
  const email = keys.email?.trim().toLowerCase() || null;
  // Sem nenhuma chave de correlação o webhook não saberia onde gravar.
  if (!apolloPersonId && !linkedinUrl && !email) return 0;

  const supabase = supabaseAdmin;
  let pending = 0;

  for (const target of targets) {
    // Reaproveita uma revelação pendente do mesmo destino em vez de acumular
    // linhas a cada reenriquecimento.
    const { data: existing } = await supabase
      .from("apollo_phone_reveals")
      .select("id")
      .eq("entity_type", target.entityType)
      .eq("entity_id", target.entityId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    const patch = {
      workspace_id: target.workspaceId,
      entity_type: target.entityType,
      entity_id: target.entityId,
      apollo_person_id: apolloPersonId,
      linkedin_url: linkedinUrl,
      email,
      signal: keys.signal ?? null,
      status: "pending",
    };

    const row = existing as { id: string } | null;
    const { error } = row
      ? await supabase
          .from("apollo_phone_reveals")
          .update(patch as never)
          .eq("id", row.id)
      : await supabase.from("apollo_phone_reveals").insert(patch as never);
    if (!error) pending += 1;
    else console.warn(`[apollo] registro de revelação falhou: ${error.message}`);
  }

  return pending;
}

/** Há revelação pendente para este destino? (usado pela UI de qualificação) */
export async function hasPendingApolloReveal(
  entityType: "lead" | "contact",
  entityId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("apollo_phone_reveals")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return !!data;
}
