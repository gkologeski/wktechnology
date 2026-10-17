/**
 * Guarda no CRM a indicação recebida de um terceiro. Nunca envia mensagem ao
 * indicado. Escopo sempre pelo workspace do job (vindo do servidor).
 */
import type { Referral } from "./third-party";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type SaveReferralResult =
  | { status: "existing"; entity: "lead" | "contact"; id: string }
  | { status: "created"; entity: "lead"; id: string }
  | { status: "ambiguous"; candidates: number }
  | { status: "failed"; error: string };

export async function saveReferral(
  admin: Admin,
  p: {
    workspaceId: string;
    ownerId: string;
    referral: Referral;
    referrerLabel: string;
    companyId: string | null;
    referrer: { entity: "lead" | "contact"; id: string } | null;
  },
): Promise<SaveReferralResult> {
  const variants = brPhoneVariants(p.referral.phoneE164);
  const [c, l] = await Promise.all([
    admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", p.workspaceId)
      .in("whatsapp_e164", variants)
      .limit(3),
    admin
      .from("leads")
      .select("id")
      .eq("workspace_id", p.workspaceId)
      .in("whatsapp_e164", variants)
      .limit(3),
  ]);
  if (c.error || l.error) return { status: "failed", error: (c.error ?? l.error).message };
  const hits = [
    ...(c.data ?? []).map((r: { id: string }) => ({ entity: "contact" as const, id: r.id })),
    ...(l.data ?? []).map((r: { id: string }) => ({ entity: "lead" as const, id: r.id })),
  ];
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const note = `Indicado por ${p.referrerLabel} via Lia em ${date}.`;
  let result: SaveReferralResult;
  if (hits.length > 1) result = { status: "ambiguous", candidates: hits.length };
  else if (hits.length === 1) result = { status: "existing", ...hits[0] };
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
    const [first, ...rest] = (p.referral.name ?? "Indicação").trim().split(/\s+/);
    const { data: row, error } = await admin
      .from("leads")
      .insert({
        workspace_id: p.workspaceId,
        owner_id: p.ownerId,
        assigned_to: p.ownerId,
        first_name: first || "Indicação",
        last_name: rest.join(" ") || null,
        phone: p.referral.phoneE164,
        whatsapp_e164: p.referral.phoneE164,
        company_id: p.companyId,
        company_name: companyName,
        source: "Indicação (Lia)",
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
          ? " Há mais de um cadastro com esse número; escolha manualmente."
          : "";
    await admin.from("activities").insert({
      workspace_id: p.workspaceId,
      owner_id: p.ownerId,
      type: "note",
      completed: true,
      subject: "Indicação recebida pela Lia",
      body: `${p.referral.name ?? "Contato"} — ${p.referral.phoneE164}.${target}`,
      [p.referrer.entity === "lead" ? "related_lead_id" : "related_contact_id"]: p.referrer.id,
      related_company_id: p.companyId,
    });
  }
  return result;
}
