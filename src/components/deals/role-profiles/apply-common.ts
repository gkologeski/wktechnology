// Aplicar campos comuns entre perfis: puro e testado (apply-common.test.ts).
import type { ProfileData } from "@/lib/role-profiles/schema";

export type CommonGroup = "conditions" | "selection" | "behavior" | "methodologies" | "hiring";

export const COMMON_GROUPS: { key: CommonGroup; label: string }[] = [
  { key: "conditions", label: "Condições (modelo, local, jornada, início)" },
  { key: "behavior", label: "Escolaridade, idiomas e competências comportamentais" },
  { key: "methodologies", label: "Metodologias e contexto do projeto" },
  { key: "hiring", label: "Contratação (outsourcing e hunting)" },
  { key: "selection", label: "Seleção e aprovação" },
];

const filled = (v: unknown): boolean =>
  v !== undefined &&
  v !== null &&
  !(typeof v === "string" && v.trim() === "") &&
  !(Array.isArray(v) && v.length === 0) &&
  !(typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every((x) => !filled(x)));

type Pick = { label: string; get: (d: ProfileData) => unknown; set: (d: ProfileData, v: unknown) => ProfileData };

const FIELDS: Record<CommonGroup, Pick[]> = {
  conditions: [
    {
      label: "Condições",
      get: (d) => d.conditions,
      set: (d, v) => ({ ...d, conditions: structuredClone(v) as ProfileData["conditions"] }),
    },
  ],
  behavior: [
    {
      label: "Escolaridade",
      get: (d) => d.requirements.education,
      set: (d, v) => ({ ...d, requirements: { ...d.requirements, education: structuredClone(v) as never } }),
    },
    {
      label: "Idiomas",
      get: (d) => d.requirements.languages,
      set: (d, v) => ({ ...d, requirements: { ...d.requirements, languages: structuredClone(v) as never } }),
    },
    {
      label: "Competências comportamentais",
      get: (d) => d.requirements.soft_skills,
      set: (d, v) => ({ ...d, requirements: { ...d.requirements, soft_skills: structuredClone(v) as never } }),
    },
  ],
  methodologies: [
    {
      label: "Metodologias",
      get: (d) => d.role.methodologies,
      set: (d, v) => ({ ...d, role: { ...d.role, methodologies: structuredClone(v) as never } }),
    },
    {
      label: "Contexto do projeto",
      get: (d) => d.role.project_context,
      set: (d, v) => ({ ...d, role: { ...d.role, project_context: v as string | undefined } }),
    },
  ],
  hiring: [
    {
      label: "Outsourcing",
      get: (d) => d.outsourcing,
      set: (d, v) => ({ ...d, outsourcing: structuredClone(v) as ProfileData["outsourcing"] }),
    },
    {
      label: "Hunting",
      // Honorários antigos (fee_*) nunca são copiados.
      get: (d) => {
        const { fee_type: _a, fee_value: _b, fee_terms: _c, guarantee_days: _g, ...rest } = d.hunting;
        return rest;
      },
      set: (d, v) => ({ ...d, hunting: { ...d.hunting, ...(structuredClone(v) as object) } }),
    },
  ],
  selection: [
    {
      label: "Seleção",
      get: (d) => d.selection,
      set: (d, v) => ({ ...d, selection: structuredClone(v) as ProfileData["selection"] }),
    },
  ],
};

export function applyCommon(src: ProfileData, target: ProfileData, groups: CommonGroup[]): ProfileData {
  let out = target;
  for (const g of groups) for (const f of FIELDS[g]) out = f.set(out, f.get(src));
  return out;
}

/** Rótulos dos campos do alvo que já têm valor diferente e seriam sobrescritos. */
export function overwrittenBy(src: ProfileData, target: ProfileData, groups: CommonGroup[]): string[] {
  const out: string[] = [];
  for (const g of groups)
    for (const f of FIELDS[g]) {
      const t = f.get(target);
      if (filled(t) && JSON.stringify(t) !== JSON.stringify(f.get(src))) out.push(f.label);
    }
  return out;
}
