import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlaybooks } from "@/lib/sdr-agent.functions";

/** Lista de agentes + agente principal (⭐) do workspace. */
export function useSdrPlaybooks() {
  const fn = useServerFn(listPlaybooks);
  const q = useQuery({ queryKey: ["sdr-playbooks"], queryFn: () => fn(), staleTime: 30_000 });
  return { ...q, defaultPlaybookId: q.data?.defaultPlaybookId ?? null };
}
