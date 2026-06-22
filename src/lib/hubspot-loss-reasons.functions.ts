// Fetches options for the HubSpot deal property `closed_lost_reason`.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

export type LossReasonOption = {
  label: string;
  value: string;
};

export const getHubspotLossReasons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ options: LossReasonOption[]; source: "hubspot" | "fallback" }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

    const fallback: LossReasonOption[] = [
      { label: "Preço", value: "price" },
      { label: "Concorrente", value: "competitor" },
      { label: "Sem retorno", value: "no_response" },
      { label: "Sem orçamento", value: "no_budget" },
      { label: "Timing", value: "timing" },
      { label: "Outro", value: "other" },
    ];

    if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
      return { options: fallback, source: "fallback" };
    }

    try {
      const res = await fetch(`${GATEWAY_URL}/crm/v3/properties/deals/closed_lost_reason`, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": HUBSPOT_API_KEY,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return { options: fallback, source: "fallback" };
      const data = (await res.json()) as {
        options?: Array<{ label?: string; value?: string; hidden?: boolean }>;
      };
      const opts = (data.options ?? [])
        .filter((o) => !o.hidden && o.value)
        .map((o) => ({ label: o.label || String(o.value), value: String(o.value) }));
      if (!opts.length) return { options: fallback, source: "fallback" };
      return { options: opts, source: "hubspot" };
    } catch {
      return { options: fallback, source: "fallback" };
    }
  });
