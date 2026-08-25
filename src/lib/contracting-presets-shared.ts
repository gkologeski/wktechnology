// Helpers client-safe para aplicar presets de contratação em itens de linha
// (negócios, propostas, cotações) e em sugestões de alocação de pessoas.
// Nada aqui toca banco: só formata/normaliza o que a server function retornou.

export type PresetOption = {
  id: string;
  name: string;
  code: string | null;
  service_catalog_id: string | null;
  job_profile_id: string | null;
  seniority: string | null;
  competencies: string[] | null;
  unit: string | null;
  default_unit_price: number | null;
  default_unit_cost: number | null;
  currency: string | null;
  service_catalog?: {
    id: string;
    name: string | null;
    unit: string | null;
    base_price: number | null;
    currency: string | null;
  } | null;
  job_profile?: { id: string; name: string | null } | null;
};

/** Campos que um preset preenche em um item de linha. */
export type PresetLinePatch = {
  contracting_preset_id: string;
  job_profile_id: string | null;
  seniority: string | null;
  unit: string | null;
  unit_price?: number;
};

/**
 * Converte um preset em patch de item de linha.
 * `keepPrice` mantém o preço já digitado pelo usuário.
 */
export function presetToLinePatch(
  preset: PresetOption,
  opts: { keepPrice?: boolean } = {},
): PresetLinePatch {
  const patch: PresetLinePatch = {
    contracting_preset_id: preset.id,
    job_profile_id: preset.job_profile_id ?? null,
    seniority: preset.seniority ?? null,
    unit: preset.unit ?? preset.service_catalog?.unit ?? null,
  };
  if (!opts.keepPrice && preset.default_unit_price != null) {
    patch.unit_price = Number(preset.default_unit_price);
  }
  return patch;
}

export function presetSummary(preset: PresetOption): string {
  const parts: string[] = [];
  if (preset.job_profile?.name) parts.push(preset.job_profile.name);
  if (preset.seniority) parts.push(preset.seniority);
  if (preset.unit) parts.push(`por ${preset.unit}`);
  return parts.join(" · ");
}

export const presetsForServiceQueryKey = (serviceCatalogId: string | null | undefined) =>
  ["contracting_presets", "for-service", serviceCatalogId ?? "none"] as const;
