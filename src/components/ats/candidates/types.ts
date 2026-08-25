import type { listAtsCandidates } from "@/lib/ats/ats.functions";

export type Cand = Awaited<ReturnType<typeof listAtsCandidates>>[number];
