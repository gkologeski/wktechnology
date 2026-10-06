// Prontidão do piloto SDR para a tela de Configuração. Chamado somente depois
// da verificação de permissão do workspace. Nunca devolve tokens.
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingReadiness, pricingLabel, qualificationFeasibility } from "./readiness";

const WRITE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function loadSdrReadiness(supabase: SupabaseClient, workspaceId: string) {
  const [pbs, icp, pages, offers] = await Promise.all([
    supabase
      .from("sdr_playbooks")
      .select("id, name, enabled, mode, questionnaire_id, booking_page_id, opportunity_min_score")
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase.from("icp_criteria").select("points").eq("workspace_id", workspaceId).eq("enabled", true),
    supabase
      .from("booking_pages")
      .select("id, slug, title, active, workspace_id, owner_id, timezone, availability, calendar_account_id, duration_minutes")
      .eq("workspace_id", workspaceId),
    supabase
      .from("sdr_offers")
      .select("id, service_catalog:service_catalog(base_price)")
      .eq("workspace_id", workspaceId),
  ]);
  const err = [pbs, icp, pages, offers].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);

  const qIds = Array.from(
    new Set((pbs.data ?? []).map((p) => p.questionnaire_id).filter((x): x is string => !!x)),
  );
  const { data: questions } = qIds.length
    ? await supabase
        .from("prospecting_questions")
        .select("id, questionnaire_id, type, weight, options, text_points, text_min_chars")
        .in("questionnaire_id", qIds)
        .eq("workspace_id", workspaceId)
    : { data: [] as never[] };

  const playbooks = (pbs.data ?? []).map((p) => ({
    ...p,
    feasibility: qualificationFeasibility({
      questions: ((questions ?? []) as any[]).filter((q) => q.questionnaire_id === p.questionnaire_id),
      icpEnabledCriteria: (icp.data ?? []) as { points: number | null }[],
      threshold: Number(p.opportunity_min_score ?? 60),
    }),
  }));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bookingPages = [] as Array<{
    id: string;
    slug: string;
    title: string;
    duration_minutes: number | null;
    readiness: ReturnType<typeof bookingReadiness>;
  }>;
  for (const pg of pages.data ?? []) {
    const [{ data: member }, { data: cal }] = await Promise.all([
      supabaseAdmin
        .from("workspace_members")
        .select("status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", pg.owner_id)
        .maybeSingle(),
      pg.calendar_account_id
        ? supabaseAdmin
            .from("calendar_accounts")
            .select("provider, owner_id, workspace_id, sync_enabled, last_status, refresh_token, scopes")
            .eq("id", pg.calendar_account_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const scopes = ((cal as any)?.scopes ?? []) as string[];
    bookingPages.push({
      id: pg.id,
      slug: pg.slug,
      title: pg.title,
      duration_minutes: pg.duration_minutes,
      readiness: bookingReadiness({
        page: pg as never,
        workspaceId,
        hostActive: (member as any)?.status === "active",
        calendar: cal
          ? {
              provider: (cal as any).provider,
              owner_id: (cal as any).owner_id,
              workspace_id: (cal as any).workspace_id,
              sync_enabled: (cal as any).sync_enabled,
              last_status: (cal as any).last_status,
              has_refresh: !!(cal as any).refresh_token,
              can_write_events: scopes.some((s) => WRITE_SCOPES.includes(s)),
            }
          : null,
      }),
    });
  }

  const priceLabels = Object.fromEntries(
    (offers.data ?? []).map((o: any) => [o.id, pricingLabel(o.service_catalog?.base_price)]),
  );
  return { playbooks, bookingPages, priceLabels };
}
