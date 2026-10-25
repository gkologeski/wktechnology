// Fase 4 — Field-level access rules.
// Retorna, para o usuário atual, o modo efetivo (hidden|masked|readonly) por campo/recurso.
// Owner/admin do workspace não recebem restrições.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FieldMode = "hidden" | "masked" | "readonly";
export type FieldRulesMap = Record<string, Record<string, FieldMode>>;
// { [resource]: { [field]: mode } }

export type MyFieldRulesResult = {
  workspace_id: string | null;
  is_privileged: boolean;
  rules: FieldRulesMap;
  invalid_rules?: Array<{ resource: string; field: string; reason: string }>;
};

/**
 * Retorna todas as regras de campo efetivas do usuário atual no workspace ativo.
 * Owner do workspace (created_by) e membros com role owner/admin recebem is_privileged=true
 * e mapa vazio — nada é escondido/mascarado para eles.
 */
export const getMyFieldRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyFieldRulesResult> => {
    const { workRpc } = await import("./work-core.server");
    return workRpc<MyFieldRulesResult>(context.supabase, "shared_field_context", {});
  });
