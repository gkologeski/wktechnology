/**
 * Intenção pendente de criação de oportunidade.
 *
 * A ação de workflow "Abrir criação de oportunidade" grava uma atividade
 * marcadora (`custom_fields.ui_action = "create_deal"`). A tela do lead lê essa
 * intenção e abre o modal de criação de negócio pré-preenchido; após criar (ou
 * descartar) a intenção é concluída para não reabrir.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PendingDealIntent = {
  activity_id: string;
  pipeline_id: string | null;
  stage_value: string | null;
  due_rule: "last_business_day_of_month" | "none";
};

/** Intenção pendente mais recente de um lead (ou `null`). */
export const getPendingDealIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lead_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<PendingDealIntent | null> => {
    const { data: rows, error } = await context.supabase
      .from("activities")
      .select("id, custom_fields")
      .eq("related_lead_id", data.lead_id)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    for (const row of rows ?? []) {
      const cf = (row.custom_fields ?? {}) as Record<string, unknown>;
      if (cf["ui_action"] !== "create_deal") continue;
      const rule = cf["due_rule"];
      return {
        activity_id: (row as { id: string }).id,
        pipeline_id: typeof cf["pipeline_id"] === "string" ? (cf["pipeline_id"] as string) : null,
        stage_value: typeof cf["stage_value"] === "string" ? (cf["stage_value"] as string) : null,
        due_rule: rule === "none" ? "none" : "last_business_day_of_month",
      };
    }
    return null;
  });

/** Marca a intenção como concluída. */
export const completeDealIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ activity_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("activities")
      .update({ completed: true } as never)
      .eq("id", data.activity_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
