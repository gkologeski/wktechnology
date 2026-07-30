// Helper puro de auditoria de menu (sem React, sem Supabase).
// Percorre todos os menus do sistema e explica, item por item, por que ele
// está visível ou oculto para um determinado conjunto de permissões/papéis.
import {
  SIDEBAR_GROUPS,
  SIDEBAR_PLATFORM_ITEMS,
  SETTINGS_GROUPS,
  canSee,
  type Perms,
  type Need,
  type SidebarGroup,
} from "@/lib/menu-config";
import { ATS_SIDEBAR_GROUPS } from "@/lib/menu-config-ats";
import { CONTRACTS_SIDEBAR_GROUPS } from "@/lib/menu-config-contracts";
import { SERVICES_SIDEBAR_GROUPS } from "@/lib/menu-config-services";
import { PROJECTS_SIDEBAR_GROUPS } from "@/lib/menu-config-projects";
import { FINANCE_SIDEBAR_GROUPS } from "@/lib/menu-config-finance";
import { PEOPLE_SIDEBAR_GROUPS } from "@/lib/menu-config-people";
import { CORE_SIDEBAR_GROUPS } from "@/lib/menu-config-core";
import { ERP_SIDEBAR_GROUPS } from "@/lib/menu-config-erp";

export type MenuAuditRule =
  | "public"
  | "permission-granted"
  | "role-granted"
  | "permission-missing"
  | "role-missing";

export type MenuAuditRow = {
  /** Área de origem do item (módulo / configurações / plataforma). */
  area: string;
  group: string;
  title: string;
  url: string;
  visible: boolean;
  need: Need;
  /** Regra que decidiu o resultado. */
  rule: MenuAuditRule;
  /** Permissões que liberariam o item (quando declaradas). */
  permissionAny: string[];
  /** Permissões declaradas que o usuário NÃO possui. */
  missingKeys: string[];
  /** Permissões declaradas que o usuário possui. */
  grantedKeys: string[];
  /** Explicação em PT-BR. */
  reason: string;
};

const NEED_LABEL: Record<string, string> = {
  admin: "administrador do workspace",
  manager: "gestor",
  platform: "administrador da plataforma",
};

const MENU_AREAS: Array<{ area: string; groups: SidebarGroup[] }> = [
  { area: "TechSales", groups: SIDEBAR_GROUPS },
  { area: "Cadastros (Core)", groups: CORE_SIDEBAR_GROUPS },
  { area: "Workspace / ERP", groups: ERP_SIDEBAR_GROUPS },
  { area: "TechHire", groups: ATS_SIDEBAR_GROUPS },
  { area: "TechContracts", groups: CONTRACTS_SIDEBAR_GROUPS },
  { area: "TechServices", groups: SERVICES_SIDEBAR_GROUPS },
  { area: "TechProjects", groups: PROJECTS_SIDEBAR_GROUPS },
  { area: "TechFinance", groups: FINANCE_SIDEBAR_GROUPS },
  { area: "TechPeople", groups: PEOPLE_SIDEBAR_GROUPS },
];

function evaluate(
  area: string,
  group: string,
  title: string,
  url: string,
  need: Need,
  permissionAny: string[] | undefined,
  perms: Perms,
): MenuAuditRow {
  const declared = permissionAny ?? [];
  const owned = perms.permissions ?? new Set<string>();
  const grantedKeys = declared.filter((k) => owned.has(k));
  const missingKeys = declared.filter((k) => !owned.has(k));
  const visible = canSee(need, perms, permissionAny);

  let rule: MenuAuditRule;
  let reason: string;

  if (grantedKeys.length > 0) {
    rule = "permission-granted";
    reason = `Visível: permissão concedida (${grantedKeys.join(", ")}).`;
  } else if (!need) {
    rule = "public";
    reason = "Visível: item sem restrição de papel ou permissão.";
  } else if (visible) {
    rule = "role-granted";
    reason = `Visível: usuário tem o papel de ${NEED_LABEL[need] ?? need}.`;
  } else if (declared.length > 0) {
    rule = "permission-missing";
    reason = `Oculto: requer o papel de ${NEED_LABEL[need] ?? need} ou qualquer uma das permissões ${declared.join(", ")} — nenhuma concedida.`;
  } else {
    rule = "role-missing";
    reason = `Oculto: requer o papel de ${NEED_LABEL[need] ?? need} e nenhuma permissão granular foi declarada para este item.`;
  }

  return {
    area,
    group,
    title,
    url,
    visible,
    need,
    rule,
    permissionAny: declared,
    missingKeys,
    grantedKeys,
    reason,
  };
}

/** Audita todos os menus do sistema para o conjunto de permissões informado. */
export function auditMenus(perms: Perms): MenuAuditRow[] {
  const rows: MenuAuditRow[] = [];

  for (const { area, groups } of MENU_AREAS) {
    for (const g of groups) {
      for (const item of g.items) {
        rows.push(
          evaluate(area, g.label, item.title, item.url, item.need, item.permissionAny, perms),
        );
        for (const child of item.children ?? []) {
          rows.push(
            evaluate(
              area,
              `${g.label} › ${item.title}`,
              child.title,
              child.url,
              child.need,
              child.permissionAny,
              perms,
            ),
          );
        }
      }
    }
  }

  for (const g of SETTINGS_GROUPS) {
    for (const item of g.items) {
      rows.push(
        evaluate("Configurações", g.label, item.label, item.to, item.need, item.permissionAny, perms),
      );
    }
  }

  for (const item of SIDEBAR_PLATFORM_ITEMS) {
    rows.push(
      evaluate("Plataforma", "Plataforma", item.title, item.url, item.need, item.permissionAny, perms),
    );
  }

  return rows;
}

/** Todas as chaves de permissão referenciadas por algum item de menu. */
export function allMenuPermissionKeys(): string[] {
  const keys = new Set<string>();
  for (const row of auditMenus({ isAdmin: false, isManager: false, isPlatformAdmin: false })) {
    for (const k of row.permissionAny) keys.add(k);
  }
  return Array.from(keys).sort();
}
