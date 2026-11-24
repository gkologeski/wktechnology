import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertAnyPermission,
  assertPermission,
  getActiveWorkspaceId,
  hasPermission,
} from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { SignatureContext } from "@/lib/hiring/signature.types";
import {
  contractSignersSchema,
  type ContractSignerSuggestions,
  type SignerContact,
} from "./signers";
import { emailSchema } from "@/lib/email-schema";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_id?: string | null;
  custom_fields?: Record<string, unknown> | null;
};

type ResolvedCandidate = { contact: SignerContact; cpf: string | null };

const CONTACT_VIEW_KEYS = ["own", "team", "workspace"].map((s) => `techsales.contacts.view.${s}`);
const EVIDENCE_MANAGE_KEY = "techcontracts.signature_evidence.manage.workspace";

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function toCandidate(row: ContactRow | null | undefined): ResolvedCandidate | null {
  if (!row) return null;
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (name.length < 2) return null;
  const emailParsed = emailSchema(255).safeParse(row.email ?? "");
  if (!emailParsed.success) return null;
  const rawCpf = row.custom_fields?.["cpf"];
  const cpf = typeof rawCpf === "string" ? rawCpf.trim().slice(0, 20) || null : null;
  return { contact: { id: row.id, name, email: emailParsed.data }, cpf };
}

function isLegalSignerFlag(row: ContactRow): boolean {
  const v = row.custom_fields?.["signatario_legal"];
  return v === true || v === "true";
}

async function fetchVisibleContact(
  sb: SupabaseClient,
  workspaceId: string,
  contactId: string,
): Promise<ResolvedCandidate | null> {
  const { data } = await sb
    .from("contacts")
    .select("id,first_name,last_name,email,company_id,custom_fields")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();
  return toCandidate(data as ContactRow | null);
}

async function resolveCounterpartyContact(
  sb: SupabaseClient,
  workspaceId: string,
  contract: {
    counterparty_company_id: string | null;
    counterparty_contact_id: string | null;
    deal_id: string | null;
  },
  fallbackDealId: string | null,
): Promise<ResolvedCandidate | null> {
  if (contract.counterparty_contact_id) {
    const direct = await fetchVisibleContact(sb, workspaceId, contract.counterparty_contact_id);
    if (direct) return direct;
  }
  let companyCandidates: { row: ContactRow; candidate: ResolvedCandidate }[] = [];
  if (contract.counterparty_company_id) {
    const { data } = await sb
      .from("contacts")
      .select("id,first_name,last_name,email,company_id,custom_fields")
      .eq("workspace_id", workspaceId)
      .eq("company_id", contract.counterparty_company_id)
      .is("deleted_at", null)
      .limit(50);
    companyCandidates = ((data ?? []) as ContactRow[])
      .map((row) => ({ row, candidate: toCandidate(row) }))
      .filter((x): x is { row: ContactRow; candidate: ResolvedCandidate } => x.candidate !== null);
    const legalSigners = companyCandidates.filter((x) => isLegalSignerFlag(x.row));
    if (legalSigners.length === 1) return legalSigners[0]!.candidate;
  }
  const dealId = contract.deal_id ?? fallbackDealId;
  if (dealId) {
    const { data: deal } = await sb
      .from("deals")
      .select("primary_contact_id")
      .eq("workspace_id", workspaceId)
      .eq("id", dealId)
      .is("deleted_at", null)
      .maybeSingle();
    const primaryId = (deal as { primary_contact_id?: string | null } | null)?.primary_contact_id;
    if (primaryId) {
      const { data: row } = await sb
        .from("contacts")
        .select("id,first_name,last_name,email,company_id,custom_fields")
        .eq("workspace_id", workspaceId)
        .eq("id", primaryId)
        .is("deleted_at", null)
        .maybeSingle();
      const typed = row as ContactRow | null;
      if (
        typed &&
        (!contract.counterparty_company_id ||
          !typed.company_id ||
          typed.company_id === contract.counterparty_company_id)
      ) {
        const cand = toCandidate(typed);
        if (cand) return cand;
      }
    }
  }
  if (companyCandidates.length === 1) return companyCandidates[0]!.candidate;
  return null;
}

async function resolveOurContact(
  sb: SupabaseClient,
  workspaceId: string,
  ourEntityId: string | null,
  ourEntityCnpj: string,
): Promise<ResolvedCandidate | null> {
  let cnpjCompanyIds: string[] = [];
  if (ourEntityCnpj.length === 14) {
    const formatted = formatCnpj(ourEntityCnpj);
    const { data: cos } = await sb
      .from("companies")
      .select("id,cnpj")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("cnpj", [ourEntityCnpj, formatted])
      .limit(20);
    cnpjCompanyIds = ((cos ?? []) as { id: string; cnpj: string | null }[])
      .filter((co) => digitsOnly(co.cnpj) === ourEntityCnpj)
      .map((co) => co.id);
    if (cnpjCompanyIds.length > 0) {
      const { data: rows } = await sb
        .from("contacts")
        .select("id,first_name,last_name,email,company_id,custom_fields")
        .eq("workspace_id", workspaceId)
        .in("company_id", cnpjCompanyIds)
        .is("deleted_at", null)
        .limit(50);
      const valid = ((rows ?? []) as ContactRow[])
        .map((row) => ({ row, candidate: toCandidate(row) }))
        .filter(
          (x): x is { row: ContactRow; candidate: ResolvedCandidate } => x.candidate !== null,
        );
      const legalSigners = valid.filter((x) => isLegalSignerFlag(x.row));
      if (legalSigners.length === 1) return legalSigners[0]!.candidate;
    }
  }

  // Histórico recente de envios ForSign do workspace (via RLS do usuário).
  const { data: ops } = await (sb as any)
    .from("contract_forsign_operations")
    .select("contract_id,requested_members,created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);
  const opRows = (ops ?? []) as {
    contract_id: string;
    requested_members: { role?: string; contact_id?: string }[] | null;
  }[];
  if (opRows.length > 0) {
    const contractIds = [...new Set(opRows.map((o) => o.contract_id).filter(Boolean))];
    const { data: pastContracts } = await sb
      .from("contracts")
      .select("id,role,contracting_legal_entity_id")
      .eq("workspace_id", workspaceId)
      .in("id", contractIds);
    const byId = new Map(
      (
        (pastContracts ?? []) as {
          id: string;
          role: string | null;
          contracting_legal_entity_id: string | null;
        }[]
      ).map((c) => [c.id, c]),
    );
    const pickFromOps = (requireSameEntity: boolean): string[] => {
      const ids: string[] = [];
      for (const op of opRows) {
        const pc = byId.get(op.contract_id);
        if (!pc) continue;
        const pcEntity = pc.contracting_legal_entity_id;
        if (requireSameEntity && ourEntityId && pcEntity !== ourEntityId) continue;
        const expectedRole = pc.role === "client" ? "CONTRATANTE" : "CONTRATADO";
        const member = (op.requested_members ?? []).find(
          (m) => m.role === expectedRole && typeof m.contact_id === "string",
        );
        if (member?.contact_id && !ids.includes(member.contact_id)) ids.push(member.contact_id);
      }
      return ids;
    };
    const orderedIds = [...(ourEntityId ? pickFromOps(true) : []), ...pickFromOps(false)];
    for (const cid of orderedIds) {
      const cand = await fetchVisibleContact(sb, workspaceId, cid);
      if (cand) return cand;
    }
  }

  // Histórico recente da assinatura nativa do TechERP (via RLS do usuário).
  const { data: nativeParts } = await (sb as any)
    .from("contract_signature_participants")
    .select("document_id,role,contact_id")
    .eq("workspace_id", workspaceId)
    .in("role", ["CONTRATANTE", "CONTRATADO"])
    .limit(20);
  const partRows = (nativeParts ?? []) as {
    document_id: string;
    role: string;
    contact_id: string | null;
  }[];
  if (partRows.length > 0) {
    const docIds = [...new Set(partRows.map((p) => p.document_id).filter(Boolean))];
    const { data: evRows } = await (sb as any)
      .from("hiring_contract_evidence")
      .select("document_id,contract_id")
      .eq("workspace_id", workspaceId)
      .in("document_id", docIds);
    const evMap = new Map(
      ((evRows ?? []) as { document_id: string; contract_id: string }[]).map((e) => [
        e.document_id,
        e.contract_id,
      ]),
    );
    const contractIds = [...new Set([...evMap.values()])];
    if (contractIds.length > 0) {
      const { data: pastContracts } = await sb
        .from("contracts")
        .select("id,role,contracting_legal_entity_id")
        .eq("workspace_id", workspaceId)
        .in("id", contractIds);
      const cMap = new Map(
        (
          (pastContracts ?? []) as {
            id: string;
            role: string | null;
            contracting_legal_entity_id: string | null;
          }[]
        ).map((c) => [c.id, c]),
      );
      for (const p of partRows) {
        const cid = evMap.get(p.document_id);
        const pc = cid ? cMap.get(cid) : undefined;
        if (!pc || !p.contact_id) continue;
        const expectedRole = pc.role === "client" ? "CONTRATANTE" : "CONTRATADO";
        if (p.role !== expectedRole) continue;
        const cand = await fetchVisibleContact(sb, workspaceId, p.contact_id);
        if (cand) return cand;
      }
    }
  }

  if (cnpjCompanyIds.length > 0) {
    const { data: rows } = await sb
      .from("contacts")
      .select("id,first_name,last_name,email,company_id,custom_fields")
      .eq("workspace_id", workspaceId)
      .in("company_id", cnpjCompanyIds)
      .is("deleted_at", null)
      .limit(2);
    const valid = ((rows ?? []) as ContactRow[])
      .map((row) => toCandidate(row))
      .filter((x): x is ResolvedCandidate => x !== null);
    if (valid.length === 1) return valid[0]!;
  }
  return null;
}

/**
 * Sugere Razão Social e contatos representantes para CONTRATANTE e CONTRATADO,
 * sempre sob RLS e permissões do chamador no workspace ativo.
 */
export async function suggestContractSigners(
  sb: SupabaseClient,
  userId: string,
  contractId: string,
  verifiedWorkspaceId?: string,
): Promise<ContractSignerSuggestions> {
  const ws = verifiedWorkspaceId ?? (await getActiveWorkspaceId(sb, userId));
  if (!verifiedWorkspaceId) {
    await assertPermission(sb, userId, ws, EVIDENCE_MANAGE_KEY);
  }
  const sigCtx = await workRpc<SignatureContext>(sb, "hiring_contract_signature_context", {
    p_ws: ws,
    p_contract: contractId,
  });
  const { data: contractRow } = await sb
    .from("contracts")
    .select(
      "id,role,counterparty_kind,counterparty_company_id,counterparty_contact_id,contracting_legal_entity_id,deal_id",
    )
    .eq("workspace_id", ws)
    .eq("id", contractId)
    .maybeSingle();
  const contract = contractRow as {
    id: string;
    role: string | null;
    counterparty_kind: string | null;
    counterparty_company_id: string | null;
    counterparty_contact_id: string | null;
    contracting_legal_entity_id: string | null;
    deal_id: string | null;
  } | null;

  const isPurchase = contract ? contract.role === "client" : Boolean(sigCtx.is_purchase);
  const ourEntityId = contract?.contracting_legal_entity_id ?? sigCtx.entity_id ?? null;
  const ourEntity = sigCtx.entities.find((e) => e.id === ourEntityId) ?? null;
  const ourPartyName = ourEntity?.name ?? null;
  const ourEntityCnpj = digitsOnly(ourEntity?.cnpj);

  let counterpartyName: string | null = null;
  if (contract?.counterparty_company_id) {
    const { data: co } = await sb
      .from("companies")
      .select("name")
      .eq("workspace_id", ws)
      .eq("id", contract.counterparty_company_id)
      .is("deleted_at", null)
      .maybeSingle();
    counterpartyName = (co as { name?: string | null } | null)?.name ?? null;
  }
  const counterpartyKind: "company" | "person" =
    contract?.counterparty_kind === "person" && !contract?.counterparty_company_id
      ? "person"
      : "company";

  let canViewContacts = false;
  for (const key of CONTACT_VIEW_KEYS) {
    if (await hasPermission(sb, userId, ws, key)) {
      canViewContacts = true;
      break;
    }
  }

  let counterpartyCand: ResolvedCandidate | null = null;
  let ourCand: ResolvedCandidate | null = null;
  if (canViewContacts) {
    if (contract) {
      counterpartyCand = await resolveCounterpartyContact(sb, ws, contract, sigCtx.deal_id);
    }
    ourCand = await resolveOurContact(sb, ws, ourEntityId, ourEntityCnpj);
    if (
      counterpartyCand &&
      ourCand &&
      (counterpartyCand.contact.id === ourCand.contact.id ||
        counterpartyCand.contact.email.toLowerCase() === ourCand.contact.email.toLowerCase())
    ) {
      ourCand = null;
    }
  }

  if (counterpartyKind === "person" && !counterpartyName && counterpartyCand) {
    counterpartyName = counterpartyCand.contact.name;
  }

  const ourSuggestion = {
    partyName: ourPartyName,
    partyKind: "company" as const,
    contact: ourCand?.contact ?? null,
    cpf: ourCand?.cpf ?? null,
  };
  const counterpartySuggestion = {
    partyName: counterpartyName,
    partyKind: counterpartyKind,
    contact: counterpartyCand?.contact ?? null,
    cpf: counterpartyCand?.cpf ?? null,
  };

  return {
    isPurchase,
    contratante: isPurchase ? ourSuggestion : counterpartySuggestion,
    contratado: isPurchase ? counterpartySuggestion : ourSuggestion,
  };
}

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
