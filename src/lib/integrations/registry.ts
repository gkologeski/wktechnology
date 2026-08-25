import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Briefcase,
  Cloud,
  Linkedin,
  MapPin,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export type ProviderSlug =
  | "hubspot"
  | "apollo"
  | "lusha"
  | "viacep"
  | "contaazul"
  | "clickup"
  | "linkedin";

export type Entity = "lead" | "contact" | "company" | "deal";

export type ProviderDef = {
  slug: ProviderSlug;
  name: string;
  description: string;
  category: "crm" | "enrichment" | "address" | "finance" | "tasks" | "sourcing";
  icon: LucideIcon;
  color: string; // tailwind bg class
  authMode: "connector_gateway" | "api_key" | "oauth" | "personal_token_or_oauth" | "none";
  entities: Entity[];
  supports: {
    import?: boolean; // tem ação de importação
    enrich?: boolean; // suporta enriquecimento
    bulkEnrich?: boolean; // suporta lote
    enrichAll?: boolean; // "Enriquecer tudo"
    autoOnCreate?: boolean; // automático ao criar
    pushTask?: boolean; // criar item externo (ClickUp etc.)
    sync?: boolean; // sincronização bidirecional
    addressLookup?: boolean; // ViaCEP
    sourcing?: boolean; // busca/captura de perfis
    messaging?: boolean; // envio de mensagens
  };
  comingSoon?: boolean;
  docs: string;
  /**
   * Rota interna dedicada para providers que possuem tela própria de
   * configuração (fora do fluxo genérico de /integrations/$slug).
   */
  href?: string;
};

export const PROVIDERS: ProviderDef[] = [
  {
    slug: "hubspot",
    name: "HubSpot",
    description: "Importe contatos do HubSpot e mantenha-os sincronizados com seus Leads.",
    category: "crm",
    icon: Cloud,
    color: "bg-orange-500",
    authMode: "connector_gateway",
    entities: ["lead", "contact"],
    supports: { import: true, sync: true },
    docs: "https://developers.hubspot.com/docs/api-reference/overview",
  },
  {
    slug: "apollo",
    name: "Apollo.io",
    description: "Enriqueça leads e contatos com dados de pessoas e empresas da base do Apollo.",
    category: "enrichment",
    icon: Sparkles,
    color: "bg-violet-600",
    authMode: "api_key",
    entities: ["lead", "contact"],
    supports: { enrich: true, bulkEnrich: true, enrichAll: true, autoOnCreate: true },
    docs: "https://docs.apollo.io/reference/people-enrichment",
  },
  {
    slug: "lusha",
    name: "Lusha",
    description: "Enriqueça contatos com telefone e email B2B verificados.",
    category: "enrichment",
    icon: Users,
    color: "bg-emerald-600",
    authMode: "api_key",
    entities: ["lead", "contact", "company"],
    supports: { enrich: true, bulkEnrich: true, enrichAll: true, autoOnCreate: true },
    docs: "https://docs.lusha.com/apis/openapi.md",
  },
  {
    slug: "viacep",
    name: "ViaCEP",
    description: "Auto-preenchimento de endereço de empresas a partir do CEP.",
    category: "address",
    icon: MapPin,
    color: "bg-sky-600",
    authMode: "none",
    entities: ["company"],
    supports: { addressLookup: true, bulkEnrich: true, enrichAll: true },
    docs: "https://viacep.com.br/",
  },
  {
    slug: "clickup",
    name: "ClickUp",
    description: "Crie tarefas no ClickUp a partir de Atividades e Negócios.",
    category: "tasks",
    icon: Briefcase,
    color: "bg-pink-600",
    authMode: "personal_token_or_oauth",
    entities: ["deal"],
    supports: { pushTask: true },
    docs: "https://developer.clickup.com/reference/createtask",
  },
  {
    slug: "contaazul",
    name: "Conta Azul",
    description:
      "Importe contas a pagar e a receber, plano de contas, contas bancárias e extratos do Conta Azul para o TechFinance.",
    category: "finance",
    icon: Building2,
    color: "bg-blue-600",
    authMode: "oauth",
    entities: ["company"],
    supports: { import: true, sync: true },
    docs: "https://developers.contaazul.com/",
    href: "/integrations/contaazul",
  },
  {
    slug: "linkedin",
    name: "LinkedIn (Unipile)",
    description:
      "Conecte sua conta LinkedIn via Unipile para buscar perfis, capturar candidatos e enviar mensagens respeitando limites human-like.",
    category: "sourcing",
    icon: Linkedin,
    color: "bg-[#0A66C2]",
    authMode: "oauth",
    entities: ["contact", "lead"],
    supports: { sourcing: true, messaging: true, enrich: true },
    docs: "https://developer.unipile.com/docs/linkedin",
    href: "/settings/integrations/linkedin",
  },
];

export function getProvider(slug: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}

export const CATEGORY_LABELS: Record<ProviderDef["category"], string> = {
  crm: "CRM",
  enrichment: "Enriquecimento",
  address: "Endereço",
  finance: "Financeiro / ERP",
  tasks: "Tarefas",
  sourcing: "Sourcing & Mensageria",
};

// re-export icon for convenience
export { Zap, MessageSquare };
