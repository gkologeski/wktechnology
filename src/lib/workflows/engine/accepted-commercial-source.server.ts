import { workRpc } from "@/lib/access-control/work-core.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealLineItemRow } from "@/lib/contracts/contract-create.server";
import type { ContractDefaultsMap } from "@/lib/contracts/contract-defaults-shared";

/** Called only AFTER work_delegated_authorize(contract_from_deal) for this actor/deal.
 * The worker never substitutes the mutable deal items for the accepted proposal snapshot. */
export async function loadWorkflowAcceptedCommercialSource(
  client: SupabaseClient,
  workspaceId: string,
  dealId: string,
  actorId: string,
) {
  if (
    !actorId ||
    !(await workRpc<boolean>(client, "work_delegated_authorize", {
      p_ws: workspaceId,
      p_actor: actorId,
      p_kind: "contract_from_deal",
      p_record: dealId,
      p_copy: false,
      p_template: null,
      p_status: "draft",
    }))
  )
    throw new Error("Responsável sem permissão para esta origem comercial.");
  const sb = client as any;
  const { data: drafts, error } = await sb
    .from("contract_drafts")
    .select("id,proposal_id,body_html,client_decided_at,decided_at,prepared_terms")
    .eq("workspace_id", workspaceId)
    .eq("deal_id", dealId)
    .eq("status", "accepted")
    .order("updated_at", { ascending: false })
    .limit(2);
  if (error) throw new Error(error.message);
  if (drafts?.length !== 1 || !drafts[0].client_decided_at || !drafts[0].decided_at)
    throw new Error(
      "O workflow precisa de uma única minuta aceita neste negócio. Confira a origem na Jornada.",
    );
  const draft = drafts[0];
  const { data: proposal, error: pe } = await sb
    .from("proposals")
    .select("id,version,quote_id,company_id,legal_entity_id,payment_terms,payment_method")
    .eq("workspace_id", workspaceId)
    .eq("deal_id", dealId)
    .eq("id", draft.proposal_id)
    .eq("status", "accepted")
    .eq("locked", true)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!proposal) throw new Error("A proposta aceita da minuta não está disponível.");
  const { data: snapshot, error: se } = await sb
    .from("proposal_document_versions")
    .select("document")
    .eq("workspace_id", workspaceId)
    .eq("proposal_id", proposal.id)
    .eq("version", proposal.version)
    .maybeSingle();
  if (se) throw new Error(se.message);
  const doc = snapshot?.document;
  if (!doc?.proposal || !Array.isArray(doc.items))
    throw new Error("Proposta sem versão preservada. Não é possível reconstruir o histórico.");
  const fields: ContractDefaultsMap = {
    ...(draft.prepared_terms?.starts_at
      ? { starts_at: draft.prepared_terms.starts_at, ends_at: draft.prepared_terms.ends_at ?? null }
      : {}),
    proposal_id: proposal.id,
    quote_id: doc.proposal.quote_id ?? null,
    counterparty_company_id: doc.proposal.company_id ?? null,
    total_value: doc.proposal.total_amount ?? null,
    currency: doc.proposal.currency ?? null,
    contracting_legal_entity_id: proposal.legal_entity_id ?? null,
    payment_terms: proposal.payment_terms ?? null,
    payment_method: proposal.payment_method ?? null,
  };
  const items = (
    doc.items as Array<
      DealLineItemRow & { service?: { name: string | null }; preset?: { name: string | null } }
    >
  ).map((item) => ({
    ...item,
    service_name: item.service?.name ?? null,
    preset_name: item.preset?.name ?? null,
  }));
  return { fields, items, bodyHtml: draft.body_html as string };
}
