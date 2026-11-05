// Regras puras (client-safe) de acesso à Área de Ajuda e Treinamento.
// Espelham a fronteira do banco (help_can_read / help_can_edit na migration 0305)
// e a regra de módulos do menu (licença do workspace ∩ permissões efetivas).
import { deriveAllowedModules } from "@/lib/modules/module-permissions";

export const HELP_MODULE_KEYS = [
  "crm",
  "ats",
  "people",
  "contracts",
  "projects",
  "finance",
  "core",
  "platform",
] as const;
export type HelpModuleKey = (typeof HELP_MODULE_KEYS)[number];

export const HELP_MODULE_LABELS: Record<HelpModuleKey, { name: string; description: string }> = {
  crm: {
    name: "TechSales",
    description: "Leads, contatos, empresas, negócios, inbox e prospecção",
  },
  ats: { name: "TechHire", description: "Vagas, candidatos, entrevistas e ofertas" },
  people: { name: "TechPeople", description: "Pessoas, alocações, documentos e benefícios" },
  contracts: { name: "TechContracts", description: "Contratos, modelos e assinatura eletrônica" },
  projects: {
    name: "TechProjects",
    description: "Projetos, tarefas, marcos e apontamento de horas",
  },
  finance: { name: "TechFinance", description: "Contas a pagar e receber, NFS-e, bancos e DRE" },
  core: {
    name: "Core ERP e Configurações",
    description: "Cadastros comuns, usuários, permissões e integrações",
  },
  platform: {
    name: "Administração da plataforma",
    description: "Ferramentas exclusivas do admin da plataforma",
  },
};

export const HELP_ARTICLE_TYPES = [
  "overview",
  "quickstart",
  "howto",
  "reference",
  "troubleshooting",
  "faq",
] as const;
export type HelpArticleType = (typeof HELP_ARTICLE_TYPES)[number];

export const HELP_ARTICLE_TYPE_LABELS: Record<HelpArticleType, string> = {
  overview: "Visão geral",
  quickstart: "Primeiros 15 minutos",
  howto: "Como fazer",
  reference: "Referência",
  troubleshooting: "Erros comuns e soluções",
  faq: "Perguntas frequentes",
};

/** Chaves que permitem editar a Ajuda (mesma base de conhecimento já existente). */
export const HELP_EDIT_KEYS = [
  "techservice.kb.manage.workspace",
  "techservice.kb.update.workspace",
] as const;

export function isHelpModuleKey(value: string): value is HelpModuleKey {
  return (HELP_MODULE_KEYS as readonly string[]).includes(value);
}

export type HelpPermissionGrant = { workspaceId: string; key: string; effect: "allow" | "deny" };

export type HelpAccessInput = {
  /** Workspace ativo do usuário. */
  activeWorkspaceId: string | null;
  /** Status do vínculo no workspace ativo. */
  membershipStatus: "active" | "inactive" | null;
  isPlatformAdmin: boolean;
  isWorkspaceAdmin: boolean;
  /** Módulos licenciados; null quando o workspace não tem controle de licença. */
  licensedModules: string[] | null;
  grants: HelpPermissionGrant[];
};

/** Chaves efetivas no workspace ativo: grants de outros workspaces não contam e deny prevalece. */
export function effectiveHelpKeys(input: HelpAccessInput): Set<string> {
  const ws = input.activeWorkspaceId;
  const scoped = input.grants.filter((g) => ws && g.workspaceId === ws);
  const denied = new Set(scoped.filter((g) => g.effect === "deny").map((g) => g.key));
  return new Set(
    scoped.filter((g) => g.effect === "allow" && !denied.has(g.key)).map((g) => g.key),
  );
}

/** Decide se o usuário enxerga o material de um módulo da Ajuda. Nega por padrão. */
export function canReadHelpModule(module: string, input: HelpAccessInput): boolean {
  if (!isHelpModuleKey(module)) return false;
  if (input.isPlatformAdmin) return true;
  if (module === "platform") return false;
  if (!input.activeWorkspaceId || input.membershipStatus !== "active") return false;
  if (module === "core") return true;
  if (input.isWorkspaceAdmin) return true;
  const allowed = deriveAllowedModules(effectiveHelpKeys(input)) as string[];
  if (!allowed.includes(module)) return false;
  return input.licensedModules === null || input.licensedModules.includes(module);
}

/** Decide se um artigo específico é legível (módulo + chave mínima + publicação). */
export function canReadHelpArticle(
  article: {
    module_key: string;
    min_permission: string | null;
    is_published: boolean;
    audience: string;
  },
  input: HelpAccessInput,
): boolean {
  if (canEditHelp(input)) return true;
  if (!article.is_published || article.audience !== "internal") return false;
  if (!canReadHelpModule(article.module_key, input)) return false;
  if (input.isPlatformAdmin || !article.min_permission) return true;
  return effectiveHelpKeys(input).has(article.min_permission);
}

/** Editor: admin da plataforma ou membro ativo com permissão da base de conhecimento. */
export function canEditHelp(input: HelpAccessInput): boolean {
  if (input.isPlatformAdmin) return true;
  if (!input.activeWorkspaceId || input.membershipStatus !== "active") return false;
  const keys = effectiveHelpKeys(input);
  return HELP_EDIT_KEYS.some((k) => keys.has(k));
}
