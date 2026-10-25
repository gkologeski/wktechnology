// Leitura dos padrões de contrato do workspace (server-only).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeDefaults,
  type ContractDefaultsBundle,
  type ContractDefaultsMap,
} from "./contract-defaults-shared";
import { isContractKind, type ContractKind } from "./contract-kinds";

type Row = { document_kind: string | null; defaults: unknown };

/** Lê o pacote de padrões (geral + por tipo) do workspace. */
export async function loadContractDefaults(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ContractDefaultsBundle> {
  const { workRpc } = await import("@/lib/access-control/work-core.server");
  const data = await workRpc<Row[]>(supabase, "contract_defaults_resolve", { p_ws: workspaceId });

  const bundle: ContractDefaultsBundle = { general: {}, byKind: {} };
  for (const row of (data ?? []) as Row[]) {
    const map: ContractDefaultsMap = sanitizeDefaults(row.defaults);
    if (!row.document_kind) {
      bundle.general = map;
    } else if (isContractKind(row.document_kind)) {
      bundle.byKind[row.document_kind as ContractKind] = map;
    }
  }
  return bundle;
}
