import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getChannelAvailability } from "@/lib/channel-availability.functions";

export function useChannelAvailability() {
  const fetchFn = useServerFn(getChannelAvailability);
  return useQuery({
    queryKey: ["channel-availability"],
    queryFn: () => fetchFn(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
