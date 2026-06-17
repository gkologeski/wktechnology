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

    // Side A: atividades da entidade A ganham o FK da entidade B
    const runOne = async (filterCol: string, filterId: string, setCol: string, setId: string) => {
      let q = supabase
        .from("activities")
        .update({ [setCol]: setId } as never, { count: "exact" })
        .eq(filterCol, filterId)
        .is(setCol, null);
      if (sinceIso) q = q.gte("created_at", sinceIso);
      const { count, error } = await q.select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    };

    const [propagatedFromSource, propagatedFromTarget] = await Promise.all([
      runOne(sourceCol, sourceId, targetCol, targetId),
      runOne(targetCol, targetId, sourceCol, sourceId),
    ]);

    return { propagatedFromSource, propagatedFromTarget };
  });
