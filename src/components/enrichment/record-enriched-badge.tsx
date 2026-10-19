import { EnrichedBadge } from "@/components/enrichment/enriched-badge";
import { useRecentEnrichment, type EnrichEntity } from "@/hooks/use-recent-enrichment";

/** Selo ✨ da ficha de um único registro. */
export function RecordEnrichedBadge({ entity, id }: { entity: EnrichEntity; id: string }) {
  const { data } = useRecentEnrichment(entity, [id]);
  return <EnrichedBadge at={data?.get(id)} className="text-lg" />;
}
