// Grupo "Cadastros" — entidades globais do ERP compartilhadas entre módulos.
// Prepend no sidebar de módulos consumidores (Sales, Contracts, Services,
// Projects, Finance). NÃO é usado no TechHire/ATS, que tem catálogos próprios.
import { Building2, Users, Wrench, BriefcaseBusiness, Layers, ArrowRightLeft } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";
import type { ModuleId } from "@/lib/modules/registry";

export const CORE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Cadastros",
    items: [
      { title: "Empresas", url: "/companies", icon: Building2 },
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Catálogo de Serviços", url: "/catalog/services", icon: Wrench },
      { title: "Cargos e Perfis", url: "/catalog/job-profiles", icon: BriefcaseBusiness },
      { title: "Presets de Contratação", url: "/catalog/contracting-presets", icon: Layers },
      {
        title: "Migração de Itens de Linha",
        url: "/catalog/line-item-migration",
        icon: ArrowRightLeft,
      },
    ],
  },
];

/**
 * Módulos que consomem o Core (Cadastros) no sidebar.
 * ATS/TechHire fica fora — tem candidatos e vagas, não produtos/serviços.
 * "services" foi absorvido por "contracts" (visão de execução/faturamento).
 */
export const CORE_CONSUMER_MODULES: readonly ModuleId[] = [
  "crm",
  "contracts",
  "projects",
  "finance",
];

export function shouldInjectCoreGroups(moduleId: ModuleId): boolean {
  return CORE_CONSUMER_MODULES.includes(moduleId);
}
