// Resolve um "público" multi-entidade em uma lista de lead_ids.
// Fontes suportadas: leads, contacts, companies → contacts → leads, deals → contacts → leads, manual (UUIDs).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { applyFilters, type FilterGroup } from "@/lib/filters";

// Carrega o cliente admin sob demanda (mantém o bundle do cliente limpo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AudienceSource = "leads" | "contacts" | "companies" | "deals" | "manual" | "segment";

export type AudienceRule = {
  source: AudienceSource;
  filter?: FilterGroup;
  // só usado quando source = "manual"
  lead_ids?: string[];
  // só usado quando source = "segment"
  segment_id?: string;
};

const FilterConditionSchema: z.ZodType = z.object({
  type: z.literal("condition"),
  field: z.string(),
  op: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "ilike",
    "in",
    "is_null",
    "is_not_null",
    "contains",
    "between",
  ]),
  value: z.unknown().optional(),
});
const FilterGroupSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.literal("group"),
    op: z.enum(["and", "or"]),
    conditions: z.array(z.union([FilterConditionSchema, FilterGroupSchema])),
  }),
);
const AudienceRuleSchema = z.object({
  source: z.enum(["leads", "contacts", "companies", "deals", "manual", "segment"]),
  filter: FilterGroupSchema.optional(),
  lead_ids: z.array(z.string().uuid()).max(10000).optional(),
  segment_id: z.string().uuid().optional(),
});

export const AudienceRulesSchema = z.array(AudienceRuleSchema).max(20);

export type ResolvedAudience = {
  lead_ids: string[];
  sample: Array<{ id: string; name: string; phone: string | null; source: AudienceSource }>;
  per_rule: Array<{ source: AudienceSource; matched: number; resolved_leads: number }>;
  total: number;
};

export async function resolveAudienceServer(
  workspaceId: string,
  rules: AudienceRule[],
): Promise<ResolvedAudience> {
  const sb = await sbAdmin();
  const collected = new Map<
    string,
    { name: string; phone: string | null; source: AudienceSource }
  >();
  const perRule: ResolvedAudience["per_rule"] = [];

  for (const rule of rules) {
    if (rule.source === "manual") {
      const ids = (rule.lead_ids ?? []).filter(Boolean);
      if (ids.length === 0) {
        perRule.push({ source: "manual", matched: 0, resolved_leads: 0 });
        continue;
      }
      const { data: leads } = await sb
        .from("leads")
        .select("id, first_name, last_name, company_name, phone")
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      const arr = (leads ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        phone: string | null;
      }>;
      for (const l of arr) {
        if (!collected.has(l.id)) {
          collected.set(l.id, {
            name:
              [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
              l.company_name ||
              l.id.slice(0, 8),
            phone: l.phone,
            source: "manual",
          });
        }
      }
      perRule.push({ source: "manual", matched: ids.length, resolved_leads: arr.length });
      continue;
    }

    if (rule.source === "leads") {
      let q = sb
        .from("leads")
        .select("id, first_name, last_name, company_name, phone")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      q = applyFilters(q, rule.filter ?? null);
      const { data } = await q.limit(10000);
      const arr = (data ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        phone: string | null;
      }>;
      for (const l of arr) {
        if (!collected.has(l.id)) {
          collected.set(l.id, {
            name:
              [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
              l.company_name ||
              l.id.slice(0, 8),
            phone: l.phone,
            source: "leads",
          });
        }
      }
      perRule.push({ source: "leads", matched: arr.length, resolved_leads: arr.length });
      continue;
    }

    if (rule.source === "contacts") {
      let q = sb
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      q = applyFilters(q, rule.filter ?? null);
      const { data } = await q.limit(10000);
      const contacts = (data ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
      }>;
      const resolved = await resolveContactsToLeads(workspaceId, contacts);
      for (const r of resolved) {
        if (!collected.has(r.lead_id)) {
          collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "contacts" });
        }
      }
      perRule.push({
        source: "contacts",
        matched: contacts.length,
        resolved_leads: resolved.length,
      });
      continue;
    }

    if (rule.source === "companies") {
      let q = sb
        .from("companies")
        .select("id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      q = applyFilters(q, rule.filter ?? null);
      const { data: cos } = await q.limit(5000);
      const companyIds = ((cos ?? []) as Array<{ id: string }>).map((c) => c.id);
      let resolvedCount = 0;
      if (companyIds.length) {
        const { data: contacts } = await sb
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .in("company_id", companyIds)
          .limit(10000);
        const arr = (contacts ?? []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }>;
        const resolved = await resolveContactsToLeads(workspaceId, arr);
        resolvedCount = resolved.length;
        for (const r of resolved) {
          if (!collected.has(r.lead_id)) {
            collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "companies" });
          }
        }
      }
      perRule.push({
        source: "companies",
        matched: companyIds.length,
        resolved_leads: resolvedCount,
      });
      continue;
    }

    if (rule.source === "deals") {
      let q = sb
        .from("deals")
        .select("id, primary_contact_id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      q = applyFilters(q, rule.filter ?? null);
      const { data: deals } = await q.limit(5000);
      const dealRows = (deals ?? []) as Array<{ id: string; primary_contact_id: string | null }>;
      let resolvedCount = 0;
      if (dealRows.length) {
        const dealIds = dealRows.map((d) => d.id);
        const { data: dc } = await sb
          .from("deal_contacts")
          .select("contact_id")
          .in("deal_id", dealIds);
        const contactIds = new Set<string>();
        for (const r of (dc ?? []) as Array<{ contact_id: string }>) contactIds.add(r.contact_id);
        for (const d of dealRows) if (d.primary_contact_id) contactIds.add(d.primary_contact_id);
        if (contactIds.size > 0) {
          const { data: contacts } = await sb
            .from("contacts")
            .select("id, first_name, last_name, email, phone")
            .eq("workspace_id", workspaceId)
            .is("deleted_at", null)
            .in("id", Array.from(contactIds))
            .limit(10000);
          const arr = (contacts ?? []) as Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
          }>;
          const resolved = await resolveContactsToLeads(workspaceId, arr);
          resolvedCount = resolved.length;
          for (const r of resolved) {
            if (!collected.has(r.lead_id)) {
              collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "deals" });
            }
          }
        }
      }
      perRule.push({ source: "deals", matched: dealRows.length, resolved_leads: resolvedCount });
      continue;
    }

    if (rule.source === "segment") {
      const segmentId = rule.segment_id;
      if (!segmentId) {
        perRule.push({ source: "segment", matched: 0, resolved_leads: 0 });
        continue;
      }
      const { data: seg } = await sb
        .from("segments")
        .select("id, entity")
        .eq("id", segmentId)
        .maybeSingle();
      if (!seg) {
        perRule.push({ source: "segment", matched: 0, resolved_leads: 0 });
        continue;
      }
      const { data: members } = await sb
        .from("segment_members")
        .select("entity_id")
        .eq("segment_id", segmentId)
        .limit(20000);
      const entityIds = ((members ?? []) as Array<{ entity_id: string }>).map((m) => m.entity_id);
      if (entityIds.length === 0) {
        perRule.push({ source: "segment", matched: 0, resolved_leads: 0 });
        continue;
      }
      let resolvedCount = 0;
      if (seg.entity === "leads") {
        const { data: leads } = await sb
          .from("leads")
          .select("id, first_name, last_name, company_name, phone")
          .eq("workspace_id", workspaceId)
          .in("id", entityIds);
        const arr = (leads ?? []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          phone: string | null;
        }>;
        for (const l of arr) {
          if (!collected.has(l.id)) {
            collected.set(l.id, {
              name:
                [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
                l.company_name ||
                l.id.slice(0, 8),
              phone: l.phone,
              source: "segment",
            });
          }
        }
        resolvedCount = arr.length;
      } else if (seg.entity === "contacts") {
        const { data: contacts } = await sb
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("workspace_id", workspaceId)
          .in("id", entityIds)
          .limit(20000);
        const arr = (contacts ?? []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }>;
        const resolved = await resolveContactsToLeads(workspaceId, arr);
        for (const r of resolved) {
          if (!collected.has(r.lead_id)) {
            collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "segment" });
          }
        }
        resolvedCount = resolved.length;
      } else if (seg.entity === "companies") {
        const { data: contacts } = await sb
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("workspace_id", workspaceId)
          .in("company_id", entityIds)
          .limit(20000);
        const arr = (contacts ?? []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }>;
        const resolved = await resolveContactsToLeads(workspaceId, arr);
        for (const r of resolved) {
          if (!collected.has(r.lead_id)) {
            collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "segment" });
          }
        }
        resolvedCount = resolved.length;
      } else if (seg.entity === "deals") {
        const { data: dc } = await sb
          .from("deal_contacts")
          .select("contact_id")
          .in("deal_id", entityIds);
        const { data: deals } = await sb
          .from("deals")
          .select("primary_contact_id")
          .in("id", entityIds);
        const contactIds = new Set<string>();
        for (const r of (dc ?? []) as Array<{ contact_id: string }>) contactIds.add(r.contact_id);
        for (const d of (deals ?? []) as Array<{ primary_contact_id: string | null }>)
          if (d.primary_contact_id) contactIds.add(d.primary_contact_id);
        if (contactIds.size > 0) {
          const { data: contacts } = await sb
            .from("contacts")
            .select("id, first_name, last_name, email, phone")
            .eq("workspace_id", workspaceId)
            .in("id", Array.from(contactIds))
            .limit(20000);
          const arr = (contacts ?? []) as Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
          }>;
          const resolved = await resolveContactsToLeads(workspaceId, arr);
          for (const r of resolved) {
            if (!collected.has(r.lead_id)) {
              collected.set(r.lead_id, { name: r.name, phone: r.phone, source: "segment" });
            }
          }
          resolvedCount = resolved.length;
        }
      }
      perRule.push({ source: "segment", matched: entityIds.length, resolved_leads: resolvedCount });
      continue;
    }
  }

  const ids = Array.from(collected.keys());
  const sample = ids.slice(0, 20).map((id) => {
    const m = collected.get(id)!;
    return { id, name: m.name, phone: m.phone, source: m.source };
  });

  return { lead_ids: ids, sample, per_rule: perRule, total: ids.length };
}

// Tenta achar leads existentes vinculados aos contatos (por email ou telefone).
// Contatos sem lead correspondente são descartados.
async function resolveContactsToLeads(
  workspaceId: string,
  contacts: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  }>,
): Promise<Array<{ lead_id: string; name: string; phone: string | null }>> {
  const emails = contacts.map((c) => c.email).filter((e): e is string => !!e);
  const phones = contacts.map((c) => c.phone).filter((p): p is string => !!p);
  if (emails.length === 0 && phones.length === 0) return [];

  let q = sb
    .from("leads")
    .select("id, first_name, last_name, company_name, email, phone")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const ors: string[] = [];
  if (emails.length)
    ors.push(`email.in.(${emails.map((e) => `"${e.replace(/"/g, '\\"')}"`).join(",")})`);
  if (phones.length)
    ors.push(`phone.in.(${phones.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(",")})`);
  if (ors.length) q = q.or(ors.join(","));

  const { data } = await q.limit(20000);
  const leads = (data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  }>;

  const out = new Map<string, { lead_id: string; name: string; phone: string | null }>();
  for (const l of leads) {
    if (out.has(l.id)) continue;
    out.set(l.id, {
      lead_id: l.id,
      name:
        [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
        l.company_name ||
        l.id.slice(0, 8),
      phone: l.phone,
    });
  }
  return Array.from(out.values());
}

export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ rules: AudienceRulesSchema }).parse(i))
  .handler(async ({ data, context }): Promise<ResolvedAudience> => {
    const ws = await resolveActiveWorkspace(context.userId);
    return resolveAudienceServer(ws, data.rules as AudienceRule[]);
  });
