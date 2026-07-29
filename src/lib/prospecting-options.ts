// Opções pré-definidas para a busca de prospects no Apollo.io.
// Cada opção mantém o `value` esperado pela API do Apollo e um `label` em PT-BR.

export type ApolloOption = { value: string; label: string };

export const SENIORITY_OPTIONS: ApolloOption[] = [
  { value: "owner", label: "Sócio / Owner" },
  { value: "founder", label: "Fundador" },
  { value: "c_suite", label: "C-Level (CEO, CFO, CTO...)" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gerente" },
  { value: "senior", label: "Sênior" },
  { value: "entry", label: "Analista / Júnior" },
  { value: "intern", label: "Estagiário" },
];

export const DEPARTMENT_OPTIONS: ApolloOption[] = [
  { value: "master_engineering_technical", label: "Engenharia / TI" },
  { value: "master_information_technology", label: "Tecnologia da Informação" },
  { value: "master_sales", label: "Vendas" },
  { value: "master_marketing", label: "Marketing" },
  { value: "master_operations", label: "Operações" },
  { value: "master_finance", label: "Financeiro" },
  { value: "master_human_resources", label: "RH / Pessoas" },
  { value: "master_legal", label: "Jurídico" },
  { value: "master_consulting", label: "Consultoria" },
  { value: "master_product", label: "Produto" },
  { value: "master_design", label: "Design" },
  { value: "master_support", label: "Atendimento / Suporte" },
  { value: "master_education", label: "Educação" },
  { value: "master_medical_health", label: "Saúde" },
];

export const EMPLOYEE_RANGE_OPTIONS: ApolloOption[] = [
  { value: "1,10", label: "1-10 funcionários" },
  { value: "11,20", label: "11-20 funcionários" },
  { value: "21,50", label: "21-50 funcionários" },
  { value: "51,100", label: "51-100 funcionários" },
  { value: "101,200", label: "101-200 funcionários" },
  { value: "201,500", label: "201-500 funcionários" },
  { value: "501,1000", label: "501-1.000 funcionários" },
  { value: "1001,5000", label: "1.001-5.000 funcionários" },
  { value: "5001,10000", label: "5.001-10.000 funcionários" },
  { value: "10001,1000000", label: "10.001+ funcionários" },
];

export const REVENUE_RANGE_OPTIONS: ApolloOption[] = [
  { value: "0,1000000", label: "Até US$ 1M" },
  { value: "1000000,10000000", label: "US$ 1M - 10M" },
  { value: "10000000,50000000", label: "US$ 10M - 50M" },
  { value: "50000000,100000000", label: "US$ 50M - 100M" },
  { value: "100000000,500000000", label: "US$ 100M - 500M" },
  { value: "500000000,1000000000", label: "US$ 500M - 1B" },
  { value: "1000000000,100000000000", label: "US$ 1B+" },
];

export const EMAIL_STATUS_OPTIONS: ApolloOption[] = [
  { value: "verified", label: "Verificado" },
  { value: "likely to engage", label: "Alta probabilidade" },
  { value: "guessed", label: "Estimado" },
  { value: "unavailable", label: "Indisponível" },
];

export type ProspectFilters = {
  person_titles?: string[];
  person_not_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  organization_industry_keywords?: string[];
  organization_num_employees_ranges?: string[];
  organization_estimated_annual_revenue_ranges?: string[];
  organization_technology_uids?: string[];
  q_keywords?: string[];
  q_organization_keyword_tags?: string[];
  contact_email_status?: string[];
  organization_domains?: string[];
  organization_not_domains?: string[];
};

export const EMPTY_FILTERS: ProspectFilters = {};

export function countActiveFilters(f: ProspectFilters | null | undefined): number {
  if (!f) return 0;
  return Object.values(f).reduce((acc, v) => acc + (Array.isArray(v) && v.length > 0 ? 1 : 0), 0);
}

export function summarizeFilters(f: ProspectFilters | null | undefined): {
  industry: string;
  role_title: string;
  company_size: string;
  location: string;
  keywords: string;
} {
  const join = (arr?: string[]) => (arr && arr.length ? arr.join(", ") : "");
  return {
    industry: join(f?.organization_industry_keywords),
    role_title: join(f?.person_titles),
    company_size: join(
      f?.organization_num_employees_ranges?.map(
        (v) => EMPLOYEE_RANGE_OPTIONS.find((o) => o.value === v)?.label ?? v,
      ),
    ),
    location: join(f?.person_locations),
    keywords: join(f?.q_keywords),
  };
}
