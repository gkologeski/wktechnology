// Server functions expostas como tools do agente de IA.
// Read-only executam automaticamente; mutadoras são chamadas pelo cliente APÓS
// aprovação humana no card. Todas rodam via requireSupabaseAuth → RLS aplica
// como o próprio usuário.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";

// ————————————————————————————————————————————————————————
// READ-ONLY TOOLS (executam sem aprovação)
// ————————————————————————————————————————————————————————

export const agentSearchEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["contact", "company", "deal", "lead", "ticket"]),
        query: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const like = `%${data.query.replace(/[%_]/g, " ")}%`;
    const results: Array<{ id: string; label: string; extra?: string }> = [];

    if (data.kind === "contact") {
      const { data: rows } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company_name")
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company_name.ilike.${like}`,
        )
        .limit(5);
      (rows ?? []).forEach((r) =>
        results.push({
          id: r.id,
          label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Contato"),
          extra: [r.email, r.phone, r.company_name].filter(Boolean).join(" · "),
        }),
      );
    } else if (data.kind === "company") {
      const { data: rows } = await supabase
        .from("companies")
        .select("id, name, cnpj, description")
        .ilike("name", like)
        .limit(5);
      (rows ?? []).forEach((r) =>
        results.push({
          id: r.id,
          label: r.name,
          extra: [r.cnpj, r.description].filter(Boolean).join(" · ") || undefined,
        }),
      );
    } else if (data.kind === "deal") {
      const { data: rows } = await supabase
        .from("deals")
        .select("id, name, value, stage")
        .ilike("name", like)
        .limit(5);
      (rows ?? []).forEach((r) =>
        results.push({ id: r.id, label: r.name, extra: `R$ ${r.value} · ${r.stage}` }),
      );
    } else if (data.kind === "lead") {
      const { data: rows } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, status")
        .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
        .limit(5);
      (rows ?? []).forEach((r) =>
        results.push({
          id: r.id,
          label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Lead"),
          extra: [r.email, r.status].filter(Boolean).join(" · "),
        }),
      );
    } else if (data.kind === "ticket") {
      const { data: rows } = await supabase
        .from("tickets")
        .select("id, subject, status, stage")
        .ilike("subject", like)
        .limit(5);
      (rows ?? []).forEach((r) =>
        results.push({ id: r.id, label: r.subject, extra: `${r.stage} · ${r.status}` }),
      );
    }
    return { kind: data.kind, results };
  });

export const agentListPipelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["deal", "ticket"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: pipelines } = await context.supabase
      .from("pipelines")
      .select("id, name, entity, stages")
      .eq("entity", data.kind)
      .limit(20);
    return {
      pipelines: (pipelines ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        stages: Array.isArray(p.stages)
          ? (p.stages as Array<{ id?: string; key?: string; label?: string; name?: string }>).map(
              (s) => ({
                id: String(s.id ?? s.key ?? s.name ?? ""),
                label: String(s.label ?? s.name ?? s.id ?? ""),
              }),
            )
          : [],
      })),
    };
  });

export const agentLookupUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const like = `%${data.query.replace(/[%_]/g, " ")}%`;
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", like)
      .limit(5);
    return {
      users: (rows ?? []).map((r) => ({
        id: r.id,
        label: r.full_name || "Usuário",
      })),
    };
  });

// ————————————————————————————————————————————————————————
// MUTADORAS (chamadas pelo cliente após aprovação humana)
// ————————————————————————————————————————————————————————

const contactUpdateSchema = z
  .object({
    id: z.string().uuid(),
    first_name: z.string().min(1).max(120).optional(),
    last_name: z.string().max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    company_id: z.string().uuid().optional(),
    company_name: z.string().max(200).optional(),
  })
  .refine(
    ({ id, ...fields }) => Object.values(fields).some((value) => value !== undefined),
    "Informe ao menos um campo para atualizar.",
  );

const leadUpdateSchema = z
  .object({
    id: z.string().uuid(),
    first_name: z.string().min(1).max(120).optional(),
    last_name: z.string().max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    source: z.string().max(80).optional(),
    company_name: z.string().max(200).optional(),
    status: z.enum(["new", "contacted", "qualified", "disqualified"]).optional(),
  })
  .refine(
    ({ id, ...fields }) => Object.values(fields).some((value) => value !== undefined),
    "Informe ao menos um campo para atualizar.",
  );

export const agentUpdateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => contactUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const patch: Database["public"]["Tables"]["contacts"]["Update"] = {};
    if (fields.first_name !== undefined) patch.first_name = fields.first_name;
    if (fields.last_name !== undefined) patch.last_name = fields.last_name;
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.company_id !== undefined) patch.company_id = fields.company_id;
    if (fields.company_name !== undefined) patch.company_name = fields.company_name;
    const { data: row, error } = await context.supabase
      .from("contacts")
      .update(patch)
      .eq("id", id)
      .select("id, first_name, last_name, email")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      url: `/contacts/${row.id}`,
      summary: `Contato ${[row.first_name, row.last_name].filter(Boolean).join(" ")} atualizado.`,
    };
  });

export const agentUpdateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => leadUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const patch: Database["public"]["Tables"]["leads"]["Update"] = {};
    if (fields.first_name !== undefined) patch.first_name = fields.first_name;
    if (fields.last_name !== undefined) patch.last_name = fields.last_name;
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.source !== undefined) patch.source = fields.source;
    if (fields.company_name !== undefined) patch.company_name = fields.company_name;
    if (fields.status !== undefined) patch.status = fields.status;
    const { data: row, error } = await context.supabase
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select("id, first_name, last_name, email")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      url: `/leads/${row.id}`,
      summary: `Lead ${[row.first_name, row.last_name].filter(Boolean).join(" ")} atualizado.`,
    };
  });

export const agentCreateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        first_name: z.string().min(1).max(120),
        last_name: z.string().max(120).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(40).optional(),
        company_id: z.string().uuid().optional(),
        company_name: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("contacts")
      .insert({ owner_id: context.userId, ...data })
      .select("id, first_name, last_name, email")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      url: `/contacts/${row.id}`,
      summary: `Contato ${[row.first_name, row.last_name].filter(Boolean).join(" ")} criado.`,
    };
  });

export const agentCreateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(200),
        cnpj: z.string().max(20).optional(),
        description: z.string().max(1000).optional(),
        phone: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("companies")
      .insert({ owner_id: context.userId, ...data })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, url: `/companies/${row.id}`, summary: `Empresa ${row.name} criada.` };
  });

export const agentCreateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        first_name: z.string().min(1).max(120),
        last_name: z.string().max(120).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(40).optional(),
        source: z.string().max(80).optional(),
        company_name: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const dup = await checkLeadDuplicate(context.supabase, {
      email: data.email ?? null,
      phone: data.phone ?? null,
    });
    if (dup.duplicate) {
      return {
        id: dup.existingId ?? "",
        url: dup.existingId ? `/leads/${dup.existingId}` : "/leads",
        summary: dup.message ?? "Lead duplicado detectado.",
      };
    }
    const { data: row, error } = await context.supabase
      .from("leads")
      .insert({ owner_id: context.userId, ...data })
      .select("id, first_name, last_name")
      .single();
    if (error) throw new Error(error.message);
    // Garante empresa e contato vinculados ao lead
    const { ensureLeadRelationsSafe } = await import("@/lib/leads/lead-relations");
    await ensureLeadRelationsSafe(context.supabase, row.id);
    return {
      id: row.id,
      url: `/leads/${row.id}`,
      summary: `Lead ${[row.first_name, row.last_name].filter(Boolean).join(" ")} criado.`,
    };
  });

export const agentCreateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(200),
        value: z.number().nonnegative().optional(),
        pipeline_id: z.string().uuid().optional(),
        stage_id: z.string().max(100).optional(),
        company_id: z.string().uuid().optional(),
        contact_id: z.string().uuid().optional(),
        expected_close_date: z.string().optional(),
        description: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { contact_id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("deals")
      .insert({ owner_id: context.userId, value: 0, ...rest })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    if (contact_id) {
      await context.supabase
        .from("deal_contacts")
        .insert({ deal_id: row.id, contact_id })
        .then(
          () => null,
          () => null,
        );
    }
    return { id: row.id, url: `/deals/${row.id}`, summary: `Negócio ${row.name} criado.` };
  });

export const agentCreateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        pipeline_id: z.string().uuid(),
        stage: z.string().max(100).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignee_id: z.string().uuid().optional(),
        contact_id: z.string().uuid().optional(),
        company_id: z.string().uuid().optional(),
        deal_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tickets")
      .insert({ owner_id: context.userId, stage: data.stage ?? "new", ...data })
      .select("id, subject")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, url: `/tickets/${row.id}`, summary: `Chamado "${row.subject}" criado.` };
  });

export const agentCreateActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["note", "call", "email", "task", "meeting"]),
        subject: z.string().max(200).optional(),
        body: z.string().max(10000).optional(),
        due_date: z.string().optional(),
        related_contact_id: z.string().uuid().optional(),
        related_company_id: z.string().uuid().optional(),
        related_deal_id: z.string().uuid().optional(),
        related_lead_id: z.string().uuid().optional(),
        related_ticket_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("activities")
      .insert({ owner_id: context.userId, ...data })
      .select("id, type, subject")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      summary: `${row.type === "note" ? "Nota" : row.type === "call" ? "Ligação" : row.type === "email" ? "E-mail" : row.type === "task" ? "Tarefa" : "Reunião"} "${row.subject ?? ""}" registrada.`,
    };
  });

export const agentCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        body: z.string().max(4000).optional(),
        due_date: z.string().optional(),
        related_contact_id: z.string().uuid().optional(),
        related_company_id: z.string().uuid().optional(),
        related_deal_id: z.string().uuid().optional(),
        related_lead_id: z.string().uuid().optional(),
        related_ticket_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("activities")
      .insert({ owner_id: context.userId, type: "task", ...data })
      .select("id, subject")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, summary: `Tarefa "${row.subject}" criada.` };
  });

export const agentCreateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        body: z.string().max(4000).optional(),
        starts_at: z.string(),
        related_contact_id: z.string().uuid().optional(),
        related_company_id: z.string().uuid().optional(),
        related_deal_id: z.string().uuid().optional(),
        related_lead_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Registra como activity type=meeting (evita depender de campos obrigatórios da tabela meetings)
    const { data: row, error } = await context.supabase
      .from("activities")
      .insert({
        owner_id: context.userId,
        type: "meeting",
        subject: data.subject,
        body: data.body,
        due_date: data.starts_at,
        related_contact_id: data.related_contact_id,
        related_company_id: data.related_company_id,
        related_deal_id: data.related_deal_id,
        related_lead_id: data.related_lead_id,
      })
      .select("id, subject")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, summary: `Reunião "${row.subject}" agendada.` };
  });
