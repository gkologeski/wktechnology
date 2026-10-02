// Monta o contexto de variáveis ({{...}}) de um modelo de contrato.
// Server-only: usado pelos modelos e pela conversão Proposta/Cotação -> Contrato.
/* eslint-disable @typescript-eslint/no-explicit-any */

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export type MergeInput = {
  templateId: string;
  dealId?: string;
  companyId?: string;
  serviceCatalogId?: string;
  title?: string;
};

export async function buildMergeContext(
  supabase: any,
  workspaceId: string,
  userId: string,
  input: MergeInput,
  template: Record<string, any>,
) {
  const defaults = (template.defaults ?? {}) as Record<string, unknown>;

  let deal: any = null;
  if (input.dealId) {
    const { data } = await supabase
      .from("deals")
      .select("id, name, value, currency, company_id")
      .eq("id", input.dealId)
      .maybeSingle();
    deal = data;
  }

  const companyId = input.companyId ?? deal?.company_id ?? null;
  let company: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, cnpj, address, city, state, phone")
      .eq("id", companyId)
      .maybeSingle();
    company = data;
  }

  let contact: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(1);
    contact = data?.[0] ?? null;
  }

  const { data: entity } = await supabase
    .from("legal_entities")
    .select("id, name, cnpj")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  let service: any = null;
  if (input.serviceCatalogId) {
    const { data } = await supabase
      .from("service_catalog")
      .select("name, description, unit, base_price, currency, service_type")
      .eq("id", input.serviceCatalogId)
      .maybeSingle();
    service = data;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const now = new Date();
  const title =
    input.title?.trim() ||
    (deal?.name
      ? `${template.name} — ${deal.name}`
      : company?.name
        ? `${template.name} — ${company.name}`
        : template.name);

  const contract = {
    number: generateNumber(),
    title,
    starts_at: (defaults.starts_at as string) ?? null,
    ends_at: (defaults.ends_at as string) ?? null,
    notice_days: (defaults.notice_days as number) ?? 30,
    total_value: (defaults.total_value as number) ?? deal?.value ?? service?.base_price ?? 0,
    monthly_value: (defaults.monthly_value as number) ?? null,
    currency: (defaults.currency as string) ?? deal?.currency ?? service?.currency ?? "BRL",
    payment_day: (defaults.payment_day as number) ?? null,
    payment_method: (defaults.payment_method as string) ?? null,
    readjustment_index: (defaults.readjustment_index as string) ?? null,
    penalty_percent: (defaults.penalty_percent as number) ?? null,
    service_type: template.service_type ?? service?.service_type ?? null,
    service_scope: (defaults.service_scope as string) ?? service?.description ?? null,
    service_location: (defaults.service_location as string) ?? null,
    jurisdiction: (defaults.jurisdiction as string) ?? null,
    governing_law: (defaults.governing_law as string) ?? null,
  };

  const ctx = {
    contract,
    counterparty: {
      name: company?.name ?? null,
      cnpj: company?.cnpj ?? null,
      address: company?.address ?? null,
      city: company?.city ?? null,
      state: company?.state ?? null,
    },
    contracting: { name: entity?.name ?? null, cnpj: entity?.cnpj ?? null, address: null },
    contact: {
      full_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    deal: { name: deal?.name ?? null, value: deal?.value ?? null },
    service: {
      name: service?.name ?? null,
      description: service?.description ?? null,
      unit: service?.unit ?? null,
      base_price: service?.base_price ?? null,
    },
    today: now.toLocaleDateString("pt-BR"),
    today_long: now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    agent: { name: profile?.full_name ?? null, email: profile?.email ?? null },
  };

  return { ctx, contract, company, deal, entity };
}
