import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPersonPhotoUrls } from "@/lib/people/person-photo.functions";

/** URLs assinadas das fotos de Contatos/Leads em lote (uma chamada por página). */
export function usePersonPhotos(
  contactIds: Array<string | null | undefined>,
  leadIds: Array<string | null | undefined> = [],
) {
  const c = [...new Set(contactIds.filter((x): x is string => !!x))].sort();
  const l = [...new Set(leadIds.filter((x): x is string => !!x))].sort();
  const fn = useServerFn(getPersonPhotoUrls);
  const q = useQuery({
    queryKey: ["person-photos", c, l],
    enabled: c.length + l.length > 0,
    staleTime: 50 * 60_000,
    queryFn: () => fn({ data: { contactIds: c.slice(0, 500), leadIds: l.slice(0, 500) } }),
  });
  return q.data ?? ({} as Record<string, string>);
}
