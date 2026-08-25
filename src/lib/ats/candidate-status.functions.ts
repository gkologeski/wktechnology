import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DerivedCandidateStatus =
  | "hired"
  | "offer"
  | "interview"
  | "in_process"
  | "archived"
  | "new";

export const DERIVED_STATUS_LABELS: Record<DerivedCandidateStatus, string> = {
  hired: "Contratado",
  offer: "Oferta",
  interview: "Entrevista",
  in_process: "Em processo",
  archived: "Arquivado",
  new: "Novo",
};

const Input = z.object({
  ids: z.array(z.string().uuid()).min(1).max(300),
});

export const getCandidateStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const ids = data.ids;
    const now = Date.now();

    const result: Record<string, DerivedCandidateStatus> = {};
    for (const id of ids) result[id] = "new";

    // Flag persistida de arquivamento (sobrescreve qualquer derivação)
    const { data: candRows } = await supabase
      .from("ats_candidates")
      .select("id, archived")
      .in("id", ids);
    const archivedSet = new Set<string>(
      ((candRows ?? []) as Array<{ id: string; archived: boolean | null }>)
        .filter((r) => r.archived === true)
        .map((r) => r.id),
    );

    // Offers (hired/offer)
    const { data: offers } = await supabase
      .from("ats_offers")
      .select("candidate_id, status")
      .in("candidate_id", ids);
    for (const o of (offers ?? []) as Array<{ candidate_id: string; status: string }>) {
      const s = o.status;
      if (s === "accepted" || s === "signed") result[o.candidate_id] = "hired";
      else if ((s === "sent" || s === "viewed") && result[o.candidate_id] !== "hired")
        result[o.candidate_id] = "offer";
    }

    // Interviews (future, not cancelled)
    const { data: ivs } = await supabase
      .from("ats_interviews")
      .select("candidate_id, scheduled_at, status")
      .in("candidate_id", ids);
    for (const i of (ivs ?? []) as Array<{
      candidate_id: string;
      scheduled_at: string | null;
      status: string;
    }>) {
      const cur = result[i.candidate_id];
      if (cur === "hired" || cur === "offer") continue;
      if (i.scheduled_at && new Date(i.scheduled_at).getTime() > now && i.status !== "cancelled") {
        result[i.candidate_id] = "interview";
      }
    }

    // Applications (in_process / archived)
    const { data: apps } = await supabase
      .from("ats_applications")
      .select("candidate_id, status")
      .in("candidate_id", ids);
    const appsByCand = new Map<string, string[]>();
    for (const a of (apps ?? []) as Array<{ candidate_id: string; status: string }>) {
      const arr = appsByCand.get(a.candidate_id) ?? [];
      arr.push(a.status);
      appsByCand.set(a.candidate_id, arr);
    }
    for (const [cid, statuses] of appsByCand) {
      const cur = result[cid];
      if (cur === "hired" || cur === "offer" || cur === "interview") continue;
      if (statuses.some((s) => s === "active")) result[cid] = "in_process";
      else if (statuses.every((s) => s === "rejected" || s === "withdrawn"))
        result[cid] = "archived";
    }
    // Aplica flag arquivado por último — sobrepõe demais classificações.
    for (const id of archivedSet) result[id] = "archived";

    return result;
  });
