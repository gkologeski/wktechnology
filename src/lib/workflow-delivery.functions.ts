// Status atual das entregas de WhatsApp dos passos de fluxo, lido com o cliente
// do usuário (RLS): mostra entregue/lida/falhou conforme os avisos da Meta.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWorkflowDeliveryStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().min(1).max(200)).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { statuses: {} as Record<string, string> };
    const { data: rows, error } = await context.supabase
      .from("whatsapp_messages")
      .select("wa_message_id, status")
      .in("wa_message_id", data.ids);
    if (error) throw new Error("Não foi possível ler o status das entregas.");
    const statuses: Record<string, string> = {};
    for (const r of rows ?? []) {
      if (r.wa_message_id && r.status) statuses[r.wa_message_id] = r.status;
    }
    return { statuses };
  });
