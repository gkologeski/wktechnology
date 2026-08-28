/**
 * Procedência do enriquecimento (componente presentacional).
 *
 * Mostra, por entidade, quais campos foram preenchidos pelo Apollo.io e de
 * qual sinal cada valor veio (LinkedIn, domínio do e-mail, nome + domínio ou
 * dados da empresa), além da origem do domínio usado na consulta.
 */
import { Badge } from "@/components/ui/badge";
import { Building2, Linkedin, Mail, Sparkles, User } from "lucide-react";
import type {
  EnrichmentSuggestions,
  FieldSource,
} from "@/lib/prospecting/qualification-enrichment.functions";

const FIELD_LABELS: Record<string, string> = {
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "E-mail",
  phone: "Telefone",
  mobile_phone: "Celular",
  job_title: "Cargo",
  company_name: "Empresa",
  linkedin_url: "LinkedIn",
  twitter_handle: "Twitter",
  twitterhandle: "Twitter",
  name: "Nome",
  domain: "Domínio",
  website: "Site",
  industry: "Segmento",
  size: "Porte",
  address: "Endereço",
  city: "Cidade",
  state: "Estado",
  country: "País",
  cep: "CEP",
  linkedin_company_page: "LinkedIn da empresa",
  facebook_company_page: "Facebook da empresa",
  annualrevenue: "Receita anual",
  description: "Descrição",
  timezone: "Fuso horário",
};

const SOURCE_LABELS: Record<FieldSource, string> = {
  linkedin: "LinkedIn do contato",
  email_domain: "domínio do e-mail",
  name_domain: "nome + domínio",
  company_domain: "dados da empresa (domínio)",
  manual: "LinkedIn informado",
};

const DOMAIN_SOURCE_LABELS: Record<string, string> = {
  website: "site da empresa",
  email: "domínio do e-mail",
  company_search: "busca por nome da empresa",
  linkedin: "perfil do LinkedIn",
};

const ENTITY_LABELS: Array<{
  key: "lead" | "companies" | "contacts";
  label: string;
  icon: typeof User;
}> = [
  { key: "lead", label: "Lead", icon: User },
  { key: "contacts", label: "Contato", icon: User },
  { key: "companies", label: "Empresa", icon: Building2 },
];

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function sourceIcon(source: FieldSource) {
  if (source === "linkedin" || source === "manual") return Linkedin;
  if (source === "email_domain") return Mail;
  if (source === "company_domain") return Building2;
  return Sparkles;
}

export function EnrichmentSourcesCard({
  enrichment,
}: {
  enrichment: Pick<
    EnrichmentSuggestions,
    "lead" | "companies" | "contacts" | "fieldSources" | "domain" | "domainSource" | "applied"
  >;
}) {
  const groups = ENTITY_LABELS.map((entity) => {
    const values = enrichment[entity.key] ?? {};
    const sources = enrichment.fieldSources?.[entity.key] ?? {};
    const appliedKey = entity.key === "lead" ? "leads" : entity.key;
    const applied = new Set(enrichment.applied?.[appliedKey] ?? []);
    const fields = Object.keys(values).map((key) => ({
      key,
      value: values[key],
      source: (sources[key] ?? "name_domain") as FieldSource,
      applied: applied.has(key),
    }));
    return { ...entity, fields };
  }).filter((g) => g.fields.length > 0);

  if (groups.length === 0) return null;

  const domainSourceLabel = enrichment.domainSource
    ? (DOMAIN_SOURCE_LABELS[enrichment.domainSource] ?? enrichment.domainSource)
    : null;

  return (
    <section
      aria-label="Procedência do enriquecimento"
      className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium">Campos preenchidos pelo enriquecimento</h3>
        {enrichment.domain ? (
          <Badge variant="outline" className="text-xs font-normal">
            Domínio {enrichment.domain}
            {domainSourceLabel ? ` · via ${domainSourceLabel}` : ""}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <group.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.fields.map((field) => {
                const Icon = sourceIcon(field.source);
                return (
                  <li key={field.key} className="text-xs leading-relaxed">
                    <span className="font-medium">{fieldLabel(field.key)}:</span>{" "}
                    <span className="text-foreground/90 break-all">{String(field.value)}</span>
                    <span className="ml-1 inline-flex items-center gap-1 text-muted-foreground">
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {SOURCE_LABELS[field.source]}
                      {field.applied ? " · gravado" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
