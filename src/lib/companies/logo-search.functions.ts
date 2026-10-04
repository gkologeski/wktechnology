import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LogoSuggestion = { name: string; domain: string; logo: string | null };

/** Sugere marcas pelo nome no catálogo gratuito da Clearbit. Nunca grava nada. */
export const searchCompanyLogos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ query: z.string().trim().min(2).max(120) }).parse(i))
  .handler(async ({ data }): Promise<{ items: LogoSuggestion[]; error: string | null }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(data.query)}`,
        { signal: ctrl.signal, headers: { Accept: "application/json" } },
      );
      if (!res.ok) {
        console.error(`Busca de logotipo falhou [${res.status}]`);
        return { items: [], error: "Catálogo de marcas indisponível no momento." };
      }
      const rows = (await res.json()) as Array<{ name?: string; domain?: string; logo?: string }>;
      const items = rows
        .filter((r) => r.domain && r.name)
        .slice(0, 5)
        .map((r) => ({ name: String(r.name), domain: String(r.domain), logo: r.logo ?? null }));
      return { items, error: null };
    } catch {
      return { items: [], error: "Catálogo de marcas indisponível no momento." };
    } finally {
      clearTimeout(timer);
    }
  });
