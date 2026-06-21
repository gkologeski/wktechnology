import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSOCIATION_KINDS = ["contact", "company", "deal", "lead", "ticket"] as const;
export type AssociationKind = (typeof ASSOCIATION_KINDS)[number];

const KIND_TO_COL: Record<AssociationKind, string> = {
  contact: "related_contact_id",
  company: "related_company_id",
  deal: "related_deal_id",
  lead: "related_lead_id",
  ticket: "related_ticket_id",
};

const Input = z.object({
  sourceKind: z.enum(ASSOCIATION_KINDS),
  sourceId: z.string().uuid(),
  targetKind: z.enum(ASSOCIATION_KINDS),
  targetId: z.string().uuid(),
  /** null = desde sempre */
  windowDays: z.number().int().positive().nullable(),
});

/**
 * Propaga retroativamente vínculos de atividades quando duas entidades são associadas.
 * Para cada lado da associação, preenche o FK do "outro lado" nas atividades existentes
 * dentro da janela de tempo escolhida (created_at >= now() - windowDays). Atividades já
 * vinculadas ao outro lado são preservadas (NOT NULL fica intacto).
 */
export const propagateAssociationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { sourceKind, sourceId, targetKind, targetId, windowDays } = data;
    if (sourceKind === targetKind) {
      return { propagatedFromSource: 0, propagatedFromTarget: 0 };
    }
    const supabase = context.supabase;

    const sinceIso =
      windowDays == null
        ? null
        : new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const sourceCol = KIND_TO_COL[sourceKind];
    const targetCol = KIND_TO_COL[targetKind];

    // Cada chamada à RPC processa 1 lote (500 linhas). Repetimos até esgotar
    // (ou atingir um teto de segurança) para evitar statement_timeout.
    const MAX_BATCHES = 200; // até ~100k linhas por lado
    const runAll = async (filterCol: string, filterId: string, setCol: string, setId: string) => {
      let total = 0;
      for (let i = 0; i < MAX_BATCHES; i++) {
        const { data: count, error } = await supabase.rpc("propagate_activity_assoc", {
          p_filter_col: filterCol,
          p_filter_id: filterId,
          p_set_col: setCol,
          p_set_id: setId,
          p_since: sinceIso ?? undefined,
        });
        if (error) throw new Error(error.message);
        const n = (count as number) ?? 0;
        total += n;
        if (n === 0) break;
      }
      return total;
    };

    const [propagatedFromSource, propagatedFromTarget] = await Promise.all([
      runAll(sourceCol, sourceId, targetCol, targetId),
      runAll(targetCol, targetId, sourceCol, sourceId),
    ]);

    return { propagatedFromSource, propagatedFromTarget };
  });
