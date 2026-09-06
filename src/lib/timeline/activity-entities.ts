// Consultas auxiliares da linha do tempo: contato-alvo das ações, associações
// automáticas ao criar atividade, membros do workspace e upload de anexos.
// Extraído de `src/components/activity-timeline.tsx` sem mudança de comportamento.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Attachment, RelatedKey, TeamMember } from "@/components/activity/timeline-shared";

export type TimelineTarget = {
  email?: string;
  phone?: string;
  contactId?: string;
  name?: string;
};

const fullName = (first?: string | null, last?: string | null) =>
  `${first ?? ""} ${last ?? ""}`.trim();

/** Resolve e-mail/telefone/contato do registro pai para os diálogos de ação. */
export async function fetchTimelineTarget(
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
      if (!data) return null;
      return {
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        name: fullName(data.first_name, data.last_name),
      };
    }
    if (relatedKey === "related_contact_id") {
      const { data } = await supabase
        .from("contacts")
        .select("id, email, phone, mobile_phone, first_name, last_name")
        .eq("id", relatedId)
        .maybeSingle();
      if (!data) return null;
      return {
        email: data.email ?? undefined,
        phone: data.phone ?? data.mobile_phone ?? undefined,
        contactId: data.id,
        name: fullName(data.first_name, data.last_name),
      };
    }
    if (relatedKey === "related_company_id") {
      const { data } = await supabase
        .from("companies")
        .select("phone, name")
        .eq("id", relatedId)
        .maybeSingle();
      if (!data) return null;
      return { phone: data.phone ?? undefined, name: data.name ?? undefined };
    }
    if (relatedKey === "related_deal_id") {
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
      if (!contactId) return { name: d?.name ?? undefined };
      const { data: c } = await supabase
        .from("contacts")
        .select("id, email, phone, mobile_phone, first_name, last_name")
        .eq("id", contactId)
        .maybeSingle();
      if (!c) return null;
      return {
        email: c.email ?? undefined,
        phone: c.phone ?? c.mobile_phone ?? undefined,
        contactId: c.id,
        name: fullName(c.first_name, c.last_name),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Associações automáticas (empresa/contato) ao registrar uma atividade. */
export async function resolveTimelineAutoLinks(
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

/** Membros do workspace ativo, para @menções e atribuição de tarefas. */
export async function fetchTimelineTeam(user: { id: string; email?: string | null }): Promise<{
  team: TeamMember[];
  workspaceId: string | null;
}> {
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

function safeFileName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(-120) || "file"
  );
}

/** Envia anexos para o bucket de notas e devolve os metadados gravados. */
export async function uploadTimelineFiles(userId: string, files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const file of files) {
    const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
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
