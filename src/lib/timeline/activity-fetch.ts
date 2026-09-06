// Acesso a dados da timeline de atividades: e-mails enriquecidos, eventos de
// calendário espelhados, histórico de propriedades, dados do registro-pai,
// membros do workspace e upload de anexos.
//
// Extraído de `src/components/activity-timeline.tsx` sem alteração de
// comportamento: mesmas queries, mesmos campos e mesma ordem de chamadas.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Activity } from "@/lib/db-types";
import type {
  Attachment,
  EmailMeta,
  RelatedKey,
  TeamMember,
} from "@/components/activity/timeline-shared";
import { calendarAttendees } from "@/components/activity/timeline-shared";
import type { PropertyChangeRow } from "@/lib/timeline/history-groups";

/** Enriquece atividades de e-mail com corpo, anexos, aberturas e cliques. */
export async function loadEmailMeta(
  baseRows: Activity[],
): Promise<{ rows: Activity[]; meta: Map<string, EmailMeta> }> {
  const emailMessageIds = [
    ...new Set(
      baseRows
        .map((row) => {
          const ext = ((row as unknown as { external_ids?: Record<string, unknown> })
            .external_ids ?? {}) as Record<string, unknown>;
          return typeof ext.email_message_id === "string" ? ext.email_message_id : null;
        })
        .filter(Boolean) as string[],
    ),
  ];
  const nextEmailMeta = new Map<string, EmailMeta>();
  if (emailMessageIds.length === 0) return { rows: baseRows, meta: nextEmailMeta };

  const [{ data: messages }, { data: events }] = await Promise.all([
    supabase
      .from("email_messages")
      .select(
        "id, direction, from_email, from_name, to_emails, cc_emails, body_html, body_text, sent_at, received_at, open_count, click_count, first_opened_at, has_attachments, attachments",
      )
      .in("id", emailMessageIds),
    supabase
      .from("email_tracking_events")
      .select("message_id, event_type, url, occurred_at")
      .in("message_id", emailMessageIds)
      .order("occurred_at", { ascending: false }),
  ]);
  type MsgRow = {
    id: string;
    direction: string | null;
    from_email: string | null;
    from_name: string | null;
    to_emails: string[] | null;
    cc_emails: string[] | null;
    body_html: string | null;
    body_text: string | null;
    sent_at: string | null;
    received_at: string | null;
    open_count: number | null;
    click_count: number | null;
    first_opened_at: string | null;
    has_attachments: boolean | null;
    attachments: unknown;
  };
  const messageById = new Map(((messages ?? []) as MsgRow[]).map((m) => [m.id, m]));
  type EvRow = {
    message_id: string;
    event_type: string;
    url: string | null;
    occurred_at: string;
  };
  const lastOpen = new Map<string, string>();
  const lastClick = new Map<string, { at: string; url: string | null }>();
  for (const e of (events ?? []) as EvRow[]) {
    if (e.event_type === "open" && !lastOpen.has(e.message_id)) {
      lastOpen.set(e.message_id, e.occurred_at);
    } else if (e.event_type === "click" && !lastClick.has(e.message_id)) {
      lastClick.set(e.message_id, { at: e.occurred_at, url: e.url });
    }
  }
  const rows = baseRows.map((row) => {
    if (row.type !== "email") return row;
    const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ??
      {}) as Record<string, unknown>;
    const messageId = typeof ext.email_message_id === "string" ? ext.email_message_id : null;
    const message = messageId ? messageById.get(messageId) : null;
    if (!message) return row;
    const attachmentsRaw = Array.isArray(message.attachments)
      ? (message.attachments as Array<Record<string, unknown>>)
      : [];
    const attachments = attachmentsRaw.map((a) => ({
      path: typeof a.path === "string" ? a.path : undefined,
      filename: typeof a.filename === "string" ? a.filename : "arquivo",
      content_type: typeof a.content_type === "string" ? a.content_type : undefined,
      size: typeof a.size === "number" ? a.size : undefined,
    }));
    const click = lastClick.get(message.id);
    const dir =
      message.direction === "inbound" || message.direction === "outbound"
        ? message.direction
        : null;
    nextEmailMeta.set(row.id, {
      direction: dir,
      from_email: message.from_email,
      from_name: message.from_name,
      to_emails: message.to_emails ?? [],
      cc_emails: message.cc_emails ?? [],
      body_html: message.body_html,
      body_text: message.body_text,
      sent_at: message.sent_at,
      received_at: message.received_at,
      open_count: Number(message.open_count ?? 0),
      click_count: Number(message.click_count ?? 0),
      first_opened_at: message.first_opened_at,
      last_opened_at: lastOpen.get(message.id) ?? null,
      last_clicked_at: click?.at ?? null,
      last_clicked_url: click?.url ?? null,
      has_attachments: Boolean(message.has_attachments),
      attachments,
    });
    const html = message.body_html?.trim() ? message.body_html : message.body_text;
    return html ? ({ ...row, body: html } as Activity) : row;
  });
  return { rows, meta: nextEmailMeta };
}

/**
 * Espelha eventos do Google Calendar via RPC `get_entity_timeline` e completa
 * atividades existentes com a gravação encontrada depois da criação.
 * Mutação em `baseRows` é intencional (mesmo comportamento de antes).
 */
export async function loadCalendarVirtuals(params: {
  relatedKey: RelatedKey;
  relatedId: string;
  baseRows: Activity[];
  start: Date | null;
  end: Date | null;
}): Promise<Activity[]> {
  const { relatedKey, relatedId, baseRows, start, end } = params;
  try {
    const kindMap: Record<RelatedKey, string> = {
      related_lead_id: "lead",
      related_contact_id: "contact",
      related_company_id: "company",
      related_deal_id: "deal",
      related_ticket_id: "ticket",
    };
    const { data: tl, error: tlErr } = await supabase.rpc("get_entity_timeline", {
      p_entity_kind: kindMap[relatedKey],
      p_entity_id: relatedId,
      p_since: start ? start.toISOString() : undefined,
      p_until: end ? end.toISOString() : undefined,
      p_limit: 300,
    });
    if (tlErr) throw tlErr;
    const calRows = ((tl ?? []) as Array<{ id: string; source: string }>).filter(
      (r) => r.source === "calendar_event",
    );
    const calIdsFromRpc = calRows.map((r) => r.id.replace(/^cal_/, "")).filter(Boolean);
    const existingCalIds = new Set(
      baseRows
        .map((row) => {
          const ext = ((row as unknown as { external_ids?: Record<string, unknown> })
            .external_ids ?? {}) as Record<string, unknown>;
          return typeof ext.calendar_event_id === "string" ? ext.calendar_event_id : null;
        })
        .filter(Boolean) as string[],
    );
    const calIds = Array.from(new Set([...calIdsFromRpc, ...existingCalIds]));
    if (calIds.length === 0) return [];

    const selectCols =
      "id, title, description, start_at, end_at, location, html_link, hangout_link, attendees, recording_url, related_contact_id, created_at";
    const { data: events } = await supabase
      .from("calendar_events")
      .select(selectCols)
      .in("id", calIds);
    const eventsById = new Map<string, Record<string, unknown>>();
    for (const e of (events ?? []) as Array<Record<string, unknown>>) {
      eventsById.set(e.id as string, e);
    }
    // Completa atividades reais com a gravação do evento, quando faltar.
    for (const row of baseRows) {
      const ext = ((row as unknown as { external_ids?: Record<string, unknown> }).external_ids ??
        {}) as Record<string, unknown>;
      const cid =
        typeof ext.calendar_event_id === "string" ? (ext.calendar_event_id as string) : null;
      if (!cid) continue;
      const ev = eventsById.get(cid);
      if (!ev) continue;
      const evRec = (ev.recording_url as string | null) ?? null;
      if (!evRec) continue;
      const r = row as unknown as {
        recording_url?: string | null;
        attachments?: Record<string, unknown> | null;
        external_ids?: Record<string, unknown> | null;
      };
      const atts = { ...((r.attachments ?? {}) as Record<string, unknown>) };
      const ex = { ...((r.external_ids ?? {}) as Record<string, unknown>) };
      if (!atts.recording_url) atts.recording_url = evRec;
      if (!ex.recording_url) ex.recording_url = evRec;
      r.attachments = atts;
      r.external_ids = ex;
      if (!r.recording_url) r.recording_url = evRec;
    }
    return Array.from(eventsById.values())
      .filter((e) => !existingCalIds.has(e.id as string))
      .map((e) => {
        const atts = calendarAttendees(e.attendees);
        return {
          id: `cal_${e.id as string}`,
          type: "meeting",
          subject: (e.title as string) ?? "Reunião (Google Calendar)",
          body: (e.description as string) ?? "",
          due_date: (e.start_at as string) ?? null,
          created_at: (e.start_at as string) ?? (e.created_at as string),
          hs_createdate: (e.start_at as string) ?? (e.created_at as string),
          meeting_location: (e.location as string) ?? (e.hangout_link as string) ?? null,
          external_ids: {
            source: "google_calendar",
            calendar_event_id: e.id,
            gcal_html_link: e.html_link ?? null,
            recording_url: e.recording_url ?? null,
          },
          attachments: {
            end_at: e.end_at ?? null,
            meet_link: e.hangout_link ?? null,
            calendar_html_link: e.html_link ?? null,
            recording_url: e.recording_url ?? null,
            attendees: atts
              .filter((a) => a.email)
              .map((a) => ({ email: a.email, name: a.displayName })),
          },
          completed: false,
          owner_id: null,
          [relatedKey]: relatedId,
        } as unknown as Activity;
      });
  } catch (e) {
    console.error("[timeline] mirrored events load", e);
    return [];
  }
}

/** Histórico de alterações da entidade no mesmo período do filtro. */
export async function loadHistoryRows(params: {
  relatedKey: RelatedKey;
  relatedId: string;
  start: Date | null;
  end: Date | null;
}): Promise<PropertyChangeRow[]> {
  const historyEntity: Record<RelatedKey, string | null> = {
    related_lead_id: "leads",
    related_contact_id: "contacts",
    related_company_id: "companies",
    related_deal_id: "deals",
    related_ticket_id: null,
  };
  const entityName = historyEntity[params.relatedKey];
  if (!entityName) return [];
  let hq = supabase
    .from("property_history")
    .select("id, entity, entity_id, property, old_value, new_value, changed_at, changed_by")
    .eq("entity", entityName)
    .eq("entity_id", params.relatedId)
    .order("changed_at", { ascending: false })
    .limit(300);
  if (params.start) hq = hq.gte("changed_at", params.start.toISOString());
  if (params.end) hq = hq.lt("changed_at", params.end.toISOString());
  const { data: hist, error: histErr } = await hq;
  if (histErr) console.error("[timeline] history load", histErr);
  return (hist ?? []) as PropertyChangeRow[];
}

export type TimelineTarget = {
  email?: string;
  phone?: string;
  contactId?: string;
  name?: string;
};

/** Resolve email/telefone/contato do registro-pai para os modais de ação. */
export async function loadTargetInfo(
  relatedKey: RelatedKey,
  relatedId: string,
): Promise<TimelineTarget | null> {
  try {
    if (relatedKey === "related_lead_id") {
      const { data } = await supabase
        .from("leads")
        .select("email, phone, first_name, last_name")
        .eq("id", relatedId)
        .maybeSingle();
      if (data) {
        return {
          email: data.email ?? undefined,
          phone: data.phone ?? undefined,
          name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
        };
      }
    } else if (relatedKey === "related_contact_id") {
      const { data } = await supabase
        .from("contacts")
        .select("id, email, phone, mobile_phone, first_name, last_name")
        .eq("id", relatedId)
        .maybeSingle();
      if (data) {
        return {
          email: data.email ?? undefined,
          phone: data.phone ?? data.mobile_phone ?? undefined,
          contactId: data.id,
          name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
        };
      }
    } else if (relatedKey === "related_company_id") {
      const { data } = await supabase
        .from("companies")
        .select("phone, name")
        .eq("id", relatedId)
        .maybeSingle();
      if (data) return { phone: data.phone ?? undefined, name: data.name ?? undefined };
    } else if (relatedKey === "related_deal_id") {
      const { data: d } = await supabase
        .from("deals")
        .select("primary_contact_id, name")
        .eq("id", relatedId)
        .maybeSingle();
      let contactId = d?.primary_contact_id ?? null;
      if (!contactId) {
        const { data: dc } = await supabase
          .from("deal_contacts")
          .select("contact_id")
          .eq("deal_id", relatedId)
          .limit(1)
          .maybeSingle();
        contactId = dc?.contact_id ?? null;
      }
      if (contactId) {
        const { data: c } = await supabase
          .from("contacts")
          .select("id, email, phone, mobile_phone, first_name, last_name")
          .eq("id", contactId)
          .maybeSingle();
        if (c) {
          return {
            email: c.email ?? undefined,
            phone: c.phone ?? c.mobile_phone ?? undefined,
            contactId: c.id,
            name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          };
        }
      } else {
        return { name: d?.name ?? undefined };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Membros do workspace ativo (para @menções e atribuição de tarefas). */
export async function loadTeam(user: {
  id: string;
  email?: string | null;
}): Promise<{ team: TeamMember[]; workspaceId: string | null }> {
  const list: TeamMember[] = [{ id: user.id, name: user.email ?? "Você" }];
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const wsId = (profile as { active_workspace_id?: string } | null)?.active_workspace_id ?? null;
  if (wsId) {
    const { data: wm } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", wsId);
    const ids = [...new Set((wm ?? []).map((t) => t.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profs ?? []) {
        if (!list.find((x) => x.id === p.id)) list.push({ id: p.id, name: p.full_name ?? p.id });
      }
    }
  }
  return { team: list, workspaceId: wsId };
}

/** Sobe anexos para o bucket de anexos de notas. */
export async function uploadTimelineFiles(
  userId: string,
  files: File[],
): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const file of files) {
    const safeName =
      file.name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(-120) || "file";
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from("notes-attachments")
      .upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(`Falha em ${file.name}: ${error.message}`);
      continue;
    }
    out.push({ path, name: file.name, size: file.size, type: file.type });
  }
  return out;
}

/** Associações automáticas aplicadas à atividade criada. */
export async function resolveAutoLinks(
  relatedKey: RelatedKey,
  relatedId: string,
): Promise<Partial<Record<RelatedKey, string>>> {
  const links: Partial<Record<RelatedKey, string>> = { [relatedKey]: relatedId };
  try {
    if (relatedKey === "related_deal_id") {
      const { data: d } = await supabase
        .from("deals")
        .select("company_id, primary_contact_id")
        .eq("id", relatedId)
        .maybeSingle();
      if (d?.company_id) links.related_company_id = d.company_id;
      let contactId = d?.primary_contact_id ?? null;
      if (!contactId) {
        const { data: dc } = await supabase
          .from("deal_contacts")
          .select("contact_id")
          .eq("deal_id", relatedId)
          .limit(1)
          .maybeSingle();
        contactId = dc?.contact_id ?? null;
      }
      if (contactId) links.related_contact_id = contactId;
    } else if (relatedKey === "related_contact_id") {
      const { data: c } = await supabase
        .from("contacts")
        .select("company_id")
        .eq("id", relatedId)
        .maybeSingle();
      if (c?.company_id) links.related_company_id = c.company_id;
    }
  } catch {
    /* default link already set */
  }
  return links;
}
