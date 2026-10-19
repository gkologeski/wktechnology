import { createServerFn } from "@tanstack/react-start";
import { orSafeTerm } from "@/lib/postgrest-search";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  entity_type: "contact" | "company" | "deal" | "ticket" | "activity" | "candidate" | "job";
  entity_id: string;
  title: string;
  subtitle?: string;
  url: string;
};

export type SearchGroup = { type: SearchHit["entity_type"]; label: string; items: SearchHit[] };

const InputSchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const limit = data.limit ?? 5;
    const raw = orSafeTerm(data.q);
    const pattern = `%${raw}%`;
    const allow = (t: string) => !data.types || data.types.length === 0 || data.types.includes(t);
    const t0 = Date.now();

    const run = async <T>(builder: PromiseLike<{ data: T | null }> | null) => {
      if (!builder) return { data: null as T | null };
      return await builder;
    };

    // Tabelas grandes: IDs candidatos via índice (função restrita aos workspaces
    // do usuário) e depois leitura normal com RLS, que decide o que ele vê.
    const candidateIds = async (entity: "contact" | "company" | "activity") => {
      const { data: ids } = await supabase.rpc("global_search_candidate_ids", {
        _entity: entity,
        _q: data.q,
      });
      return ((ids ?? []) as string[]).slice(0, 200);
    };
    const viaIds = async <T>(
      entity: "contact" | "company" | "activity",
      read: (ids: string[]) => PromiseLike<{ data: T | null }>,
    ) => {
      const ids = await candidateIds(entity);
      if (ids.length === 0) return { data: [] as unknown as T };
      return await read(ids);
    };

    const [contacts, companies, deals, tickets, activities, candidates, jobs] = await Promise.all([
      allow("contact")
        ? viaIds("contact", (ids) =>
            supabase
              .from("contacts")
              .select("id, first_name, last_name, email, job_title")
              .in("id", ids)
              .limit(limit),
          )
        : run(null),
      allow("company")
        ? viaIds("company", (ids) =>
            supabase.from("companies").select("id, name, domain").in("id", ids).limit(limit),
          )
        : run(null),
      allow("deal")
        ? run(
            supabase
              .from("deals")
              .select("id, name, stage, value, currency")
              .ilike("name", pattern)
              .limit(limit),
          )
        : run(null),
      allow("ticket")
        ? run(
            supabase
              .from("tickets")
              .select("id, subject, status, priority")
              .or(`subject.ilike.${pattern},description.ilike.${pattern}`)
              .limit(limit),
          )
        : run(null),
      allow("activity")
        ? (async () => {
            // Assunto (trigram) + texto (busca por palavras, índice FTS). O texto
            // tem limite de tempo: se estourar, o grupo fica só com o assunto.
            const bodyRpc = Promise.resolve(
              supabase.rpc("global_search_activity_body_ids", { _q: data.q, _limit: 40 }),
            ).then((r) => (r.data ?? []) as Array<{ id: string; snippet: string | null }>);
            const timeout = new Promise<null>((res) => setTimeout(() => res(null), 4000));
            const [subjectIds, bodyHits] = await Promise.all([
              candidateIds("activity"),
              Promise.race([bodyRpc.catch(() => null), timeout]),
            ]);
            const snippets = new Map<string, string>();
            for (const h of bodyHits ?? []) if (h.snippet) snippets.set(h.id, h.snippet);
            const order = [...new Set([...subjectIds, ...(bodyHits ?? []).map((h) => h.id)])];
            if (order.length === 0) return { data: [], bodyPartial: bodyHits === null };
            const { data: rows } = await supabase
              .from("activities")
              .select("id, subject, type, due_date")
              .in("id", order.slice(0, 200));
            const byId = new Map(
              ((rows ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.id), r]),
            );
            const sorted = order
              .map((id) => byId.get(id))
              .filter((r): r is Record<string, unknown> => !!r)
              .slice(0, limit)
              .map((r) => ({ ...r, snippet: snippets.get(String(r.id)) ?? null }));
            return { data: sorted, bodyPartial: bodyHits === null };
          })()
        : run(null),
      allow("candidate")
        ? run(
            supabase
              .from("ats_candidates")
              .select("id, full_name, email, current_position")
              .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
              .limit(limit),
          )
        : run(null),
      allow("job")
        ? run(
            supabase
              .from("ats_jobs")
              .select("id, title, status, location")
              .ilike("title", pattern)
              .limit(limit),
          )
        : run(null),
    ]);

    const groups: SearchGroup[] = [];

    const push = (type: SearchHit["entity_type"], label: string, items: SearchHit[]) => {
      if (items.length > 0) groups.push({ type, label, items });
    };

    push(
      "contact",
      "Contatos",
      ((contacts.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "contact" as const,
        entity_id: String(r.id),
        title:
          [r.first_name, r.last_name].filter(Boolean).join(" ") || String(r.email ?? "Contato"),
        subtitle: [r.email, r.job_title].filter(Boolean).join(" · ") || undefined,
        url: `/contacts/${r.id}`,
      })),
    );
    push(
      "company",
      "Empresas",
      ((companies.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "company" as const,
        entity_id: String(r.id),
        title: String(r.name ?? "Empresa"),
        subtitle: r.domain ? String(r.domain) : undefined,
        url: `/companies/${r.id}`,
      })),
    );
    push(
      "deal",
      "Negócios",
      ((deals.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "deal" as const,
        entity_id: String(r.id),
        title: String(r.name ?? "Negócio"),
        subtitle:
          [r.stage, r.value ? `${r.currency ?? "BRL"} ${r.value}` : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        url: `/deals/${r.id}`,
      })),
    );
    push(
      "ticket",
      "Tickets",
      ((tickets.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "ticket" as const,
        entity_id: String(r.id),
        title: String(r.subject ?? "Ticket"),
        subtitle: [r.status, r.priority].filter(Boolean).join(" · ") || undefined,
        url: `/tickets/${r.id}`,
      })),
    );
    push(
      "activity",
      "Atividades",
      ((activities.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "activity" as const,
        entity_id: String(r.id),
        title: String(r.subject ?? "Atividade"),
        subtitle: r.snippet
          ? `…${String(r.snippet).replace(/\s+/g, " ").trim()}…`
          : [r.type, r.due_date].filter(Boolean).join(" · ") || undefined,
        url: `/activities?highlight=${r.id}`,
      })),
    );
    push(
      "candidate",
      "Candidatos",
      ((candidates.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "candidate" as const,
        entity_id: String(r.id),
        title: String(r.full_name ?? r.email ?? "Candidato"),
        subtitle: [r.email, r.current_position].filter(Boolean).join(" · ") || undefined,
        url: `/candidates/${r.id}`,
      })),
    );
    push(
      "job",
      "Vagas",
      ((jobs.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity_type: "job" as const,
        entity_id: String(r.id),
        title: String(r.title ?? "Vaga"),
        subtitle: [r.status, r.location].filter(Boolean).join(" · ") || undefined,
        url: `/jobs/${r.id}`,
      })),
    );

    return { groups, took_ms: Date.now() - t0 };
  });
