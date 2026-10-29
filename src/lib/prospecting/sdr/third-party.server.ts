/**
 * Guarda no CRM a indicação recebida de um terceiro. Nunca envia mensagem ao
 * indicado. Escopo sempre pelo workspace do job (vindo do servidor).
 */
import type { ReferralInfo } from "./conversation-state";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";
import { loadSdrAgentUserId } from "./agent-identity.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type SaveReferralResult =
  | { status: "existing"; entity: "lead" | "contact"; id: string }
  | { status: "created"; entity: "lead"; id: string }
  | { status: "ambiguous"; candidates: number }
  /** Só o nome foi informado: fica como nota para revisão, sem cadastro novo. */
  | { status: "noted" }
  | { status: "failed"; error: string };

type Hit = { entity: "lead" | "contact"; id: string };

async function findByKey(
  admin: Admin,
  workspaceId: string,
  column: "whatsapp_e164" | "email",
  values: string[],
): Promise<{ hits: Hit[] } | { error: string }> {
  const [c, l] = await Promise.all(
    (["contacts", "leads"] as const).map((table) =>
      admin
        .from(table)
        .select("id")
        .eq("workspace_id", workspaceId)
        .in(column, values)
        .is("deleted_at", null)
        .limit(3),
    ),
  );
  if (c.error || l.error) return { error: (c.error ?? l.error).message };
  return {
    hits: [
      ...(c.data ?? []).map((r: { id: string }) => ({ entity: "contact" as const, id: r.id })),
      ...(l.data ?? []).map((r: { id: string }) => ({ entity: "lead" as const, id: r.id })),
    ],
  };
}

/**
 * Indicação: procura cadastro pelo telefone e depois pelo e-mail escritos
 * pelo cliente; sem nenhum, cria um Lead para revisão humana. Indicação só
 * com nome vira nota na linha do tempo de quem indicou (nada é inventado).
 */
export async function saveReferral(
  admin: Admin,
  p: {
    workspaceId: string;
    ownerId: string;
    referral: ReferralInfo;
    referrerLabel: string;
    companyId: string | null;
    referrer: { entity: "lead" | "contact"; id: string } | null;
  },
): Promise<SaveReferralResult> {
  const owner = (await loadSdrAgentUserId(admin, p.workspaceId)) ?? p.ownerId;
  const r = p.referral;
  let hits: Hit[] = [];
  if (r.phoneE164) {
    const found = await findByKey(
      admin,
      p.workspaceId,
      "whatsapp_e164",
      brPhoneVariants(r.phoneE164),
    );
    if ("error" in found) return { status: "failed", error: found.error };
    hits = found.hits;
  }
  if (!hits.length && r.email) {
    const found = await findByKey(admin, p.workspaceId, "email", [r.email]);
    if ("error" in found) return { status: "failed", error: found.error };
    hits = found.hits;
  }
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const note = `Indicado por ${p.referrerLabel} via agente SDR em ${date}.`;
  let result: SaveReferralResult;
  if (hits.length > 1) result = { status: "ambiguous", candidates: hits.length };
  else if (hits.length === 1) result = { status: "existing", ...hits[0] };
  else if (!r.phoneE164 && !r.email) result = { status: "noted" };
  else {
    let companyName: string | null = null;
    if (p.companyId) {
      const { data: co } = await admin
        .from("companies")
        .select("name")
        .eq("id", p.companyId)
        .eq("workspace_id", p.workspaceId)
        .maybeSingle();
      companyName = (co as { name?: string } | null)?.name ?? null;
    }
    const [first, ...rest] = (r.name ?? "Indicação").trim().split(/\s+/);
    const { data: row, error } = await admin
      .from("leads")
      .insert({
        workspace_id: p.workspaceId,
        owner_id: owner,
        assigned_to: owner,
        first_name: first || "Indicação",
        last_name: rest.join(" ") || null,
        ...(r.phoneE164 ? { phone: r.phoneE164, whatsapp_e164: r.phoneE164 } : {}),
        ...(r.email ? { email: r.email } : {}),
        company_id: p.companyId,
        company_name: companyName,
        source: "Indicação (agente SDR)",
        notes: note,
      })
      .select("id")
      .single();
    if (error) return { status: "failed", error: error.message };
    result = { status: "created", entity: "lead", id: (row as { id: string }).id };
  }
  // Linha do tempo de quem indicou.
  if (p.referrer) {
    const target =
      result.status === "created" || result.status === "existing"
        ? ` Registro: ${result.entity === "lead" ? "Lead" : "Contato"} ${result.id}.`
        : result.status === "ambiguous"
          ? " Há mais de um cadastro com esses dados; escolha manualmente."
          : result.status === "noted"
            ? " Sem e-mail ou telefone informado: nenhum cadastro criado."
            : "";
    const data = [r.name ?? "Contato", r.email, r.phoneE164].filter(Boolean).join(" — ");
    await admin.from("activities").insert({
      workspace_id: p.workspaceId,
      owner_id: owner,
      assigned_to: owner,
      type: "note",
      completed: true,
      subject: "Indicação recebida pelo agente SDR",
      body: `${data}.${target}`,
      [p.referrer.entity === "lead" ? "related_lead_id" : "related_contact_id"]: p.referrer.id,
      related_company_id: p.companyId,
    });
  }
  return result;
}

/**
 * Número corporativo informado pelo próprio cliente: grava no campo WhatsApp
 * do cadastro só se estiver vazio (não troca o número em uso na conversa) e
 * sempre registra uma observação na linha do tempo. Nunca envia mensagem.
 */
export async function saveCorporatePhone(
  admin: any,
  p: {
    workspaceId: string;
    ownerId: string | null;
    target: { entity: "lead" | "contact"; id: string };
    companyId: string | null;
    phoneE164: string;
  },
): Promise<"saved" | "noted"> {
  const agent = await loadSdrAgentUserId(admin, p.workspaceId);
  const owner = agent ?? p.ownerId;
  const table = p.target.entity === "lead" ? "leads" : "contacts";
  const { data: row } = await admin
    .from(table)
    .select("id, whatsapp_e164")
    .eq("id", p.target.id)
    .eq("workspace_id", p.workspaceId)
    .maybeSingle();
  let status: "saved" | "noted" = "noted";
  if (row && !row.whatsapp_e164) {
    const { error } = await admin
      .from(table)
      .update({ whatsapp_e164: p.phoneE164 })
      .eq("id", p.target.id)
      .eq("workspace_id", p.workspaceId);
    if (!error) status = "saved";
  }
  await admin.from("activities").insert({
    workspace_id: p.workspaceId,
    owner_id: owner,
    ...(agent ? { assigned_to: agent, created_by: agent } : {}),
    type: "note",
    completed: true,
    subject: "Número corporativo informado na conversa com a Lia",
    body: `O cliente informou o número ${p.phoneE164} para seguir o contato.${
      status === "saved"
        ? " Gravado no campo WhatsApp."
        : " O campo WhatsApp já tinha outro número e não foi alterado."
    }`,
    [p.target.entity === "lead" ? "related_lead_id" : "related_contact_id"]: p.target.id,
    related_company_id: p.companyId,
  });
  return status;
}
