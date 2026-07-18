// Grupo "Cadastros" — entidades globais do ERP compartilhadas entre módulos.
// Prepend no sidebar de módulos consumidores (Sales, Contracts, Services,
// Projects, Finance). NÃO é usado no TechHire/ATS, que tem catálogos próprios.
import { Building2, Users, Package, Wrench } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";
import type { ModuleId } from "@/lib/modules/registry";

export const CORE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Cadastros",
    items: [
      { title: "Empresas", url: "/companies", icon: Building2 },
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Produtos", url: "/settings/products", icon: Package },
      // Rota do catálogo de serviços chega na Sprint B (Fase 2). Até lá o
      // item é ocultado pelo componente pai — vive aqui como fonte única.
      { title: "Serviços", url: "/catalog/services", icon: Wrench },
    ],
  },
];

/**
 * Módulos que consomem o Core (Cadastros) no sidebar.
 * ATS/TechHire fica fora — tem candidatos e vagas, não produtos/serviços.
 */
export const CORE_CONSUMER_MODULES: readonly ModuleId[] = [
  "crm",
  "contracts",
  "services",
  "projects",
  "finance",
];

export function shouldInjectCoreGroups(moduleId: ModuleId): boolean {
  return CORE_CONSUMER_MODULES.includes(moduleId);
}
