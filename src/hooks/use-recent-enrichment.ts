import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isRecentAutoPhoto,
  mergeLatest,
  recentEnrichmentSince,
} from "@/lib/enrichment/recent-enrichment";

export type EnrichEntity = "lead" | "contact" | "company";

/** Mapa id → data do enriquecimento mais recente (últimos 30 dias), em lote. */
export function useRecentEnrichment(entity: EnrichEntity, ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x))).sort();
  return useQuery({
    queryKey: ["recent-enrichment", entity, unique],
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const map = new Map<string, string>();
      const since = recentEnrichmentSince().toISOString();
      const batches: string[][] = [];
      for (let i = 0; i < unique.length; i += 200) batches.push(unique.slice(i, i + 200));
      await Promise.all(
        batches.map(async (batch) => {
          if (entity === "company") {
            const { data, error } = await supabase
              .from("companies")
              .select("id, cnpj_enriched_at")
              .in("id", batch)
              .gte("cnpj_enriched_at", since);
            if (error) throw error;
            (data ?? []).forEach((r) => mergeLatest(map, r.id, r.cnpj_enriched_at));
            return;
          }
          const table = entity === "lead" ? "leads" : "contacts";
          const [items, photos] = await Promise.all([
            supabase
              .from("enrichment_job_items")
              .select("entity_id, created_at, enrichment_jobs!inner(entity)")
              .eq("status", "ok")
              .eq("enrichment_jobs.entity", entity)
              .gte("created_at", since)
              .in("entity_id", batch),
            supabase
              .from(table)
              .select("id, photo_source, photo_updated_at")
              .in("id", batch)
              .eq("photo_source", "linkedin")
              .gte("photo_updated_at", since),
          ]);
          if (items.error) throw items.error;
          if (photos.error) throw photos.error;
          (items.data ?? []).forEach(
            (r) => r.entity_id && mergeLatest(map, r.entity_id, r.created_at),
          );
          (photos.data ?? []).forEach((r) => {
            if (isRecentAutoPhoto(r.photo_source, r.photo_updated_at))
              mergeLatest(map, r.id, r.photo_updated_at);
          });
        }),
      );
      return map;
    },
  });
}
