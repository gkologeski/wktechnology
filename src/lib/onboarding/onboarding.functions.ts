// Onboarding guiado — server functions.
// Templates reutilizáveis + execução (run) com autosave e materialização
// de tarefas/workflow ao concluir.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnbEntityType = "lead" | "company" | "contact";

export type OnbField = {
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "number" | "textarea" | "select" | "date";
  required?: boolean;
  help?: string;
  options?: string[]; // para type=select
  target_column?: string; // coluna real na entidade (default = name)
};

export type OnbStep = {
  id: string;
  title: string;
  description?: string;
  fields: OnbField[];
};

export type OnbTaskTemplate = {
  title: string;
  type: "task" | "call" | "email" | "meeting" | "note";
  offset_days: number;
  body?: string;
};

export type OnbTemplateRow = {
  id: string;
  workspace_id: string | null;
  owner_id: string;
  entity_type: OnbEntityType;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  segment_field: string | null;
  segment_value: string | null;
  workflow_id: string | null;
  step_order: string[];
  field_config: OnbStep[];
  tasks_template: OnbTaskTemplate[];
  created_at: string;
  updated_at: string;
};

export type OnbRunRow = {
  id: string;
  owner_id: string;
  template_id: string | null;
  entity_type: OnbEntityType;
  entity_id: string | null;
  current_step: number;
  form_data: Record<string, string | number | boolean | null>;
  status: "draft" | "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const EntityZ = z.enum(["lead", "company", "contact"]);

const FieldZ = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "phone", "number", "textarea", "select", "date"]),
  required: z.boolean().optional(),
  help: z.string().optional(),
  options: z.array(z.string()).optional(),
  target_column: z.string().optional(),
});

const StepZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FieldZ).min(1),
});

const TaskZ = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["task", "call", "email", "meeting", "note"]),
  offset_days: z.number().int().min(0).max(365),
  body: z.string().max(2000).optional(),
});

export const listOnbTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ entity_type: EntityZ.optional() }).parse(i ?? {}))
  .handler(async ({ data, context }): Promise<{ templates: OnbTemplateRow[] }> => {
    const { supabase } = context;
    let q = supabase
      .from("onboarding_templates")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }) as unknown as {
      eq: (k: string, v: string) => typeof q;
      then: Promise<{ data: OnbTemplateRow[] | null; error: { message: string } | null }>["then"];
    };
    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    const { data: rows, error } = await (q as unknown as Promise<{
      data: OnbTemplateRow[] | null;
      error: { message: string } | null;
    }>);
    if (error) throw new Error(error.message);
    return { templates: rows ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: EntityZ,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  segment_field: z.string().max(80).nullable().optional(),
  segment_value: z.string().max(120).nullable().optional(),
  workflow_id: z.string().uuid().nullable().optional(),
  field_config: z.array(StepZ).min(1),
  tasks_template: z.array(TaskZ).default([]),
});

export const upsertOnbTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      entity_type: data.entity_type,
      name: data.name,
      description: data.description ?? null,
      is_default: data.is_default ?? false,
      is_active: data.is_active ?? true,
      segment_field: data.segment_field ?? null,
      segment_value: data.segment_value ?? null,
      workflow_id: data.workflow_id ?? null,
      step_order: data.field_config.map((s) => s.id),
      field_config: data.field_config,
      tasks_template: data.tasks_template,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("onboarding_templates")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as OnbTemplateRow;
    }
    const { data: row, error } = await supabase
      .from("onboarding_templates")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as OnbTemplateRow;
  });

export const deleteOnbTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("onboarding_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pickOnbTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity_type: EntityZ,
        segment_value: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ template: OnbTemplateRow | null }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("onboarding_templates")
      .select("*")
      .eq("entity_type", data.entity_type)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    const list = (rows as OnbTemplateRow[] | null) ?? [];
    if (list.length === 0) return { template: null };
    if (data.segment_value) {
      const seg = list.find(
        (t) =>
          t.segment_value && t.segment_value.toLowerCase() === data.segment_value!.toLowerCase(),
      );
      if (seg) return { template: seg };
    }
    const def = list.find((t) => t.is_default);
    return { template: def ?? list[0] };
  });

const startSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
  entity_type: EntityZ,
});

export const startOnbRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => startSchema.parse(i))
  .handler(async ({ data, context }): Promise<OnbRunRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("onboarding_runs")
      .insert({
        owner_id: userId,
        template_id: data.template_id ?? null,
        entity_type: data.entity_type,
        current_step: 0,
        form_data: {},
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as OnbRunRow;
  });

const saveSchema = z.object({
  run_id: z.string().uuid(),
  current_step: z.number().int().min(0),
  form_data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const saveOnbRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => saveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("onboarding_runs")
      .update({
        current_step: data.current_step,
        form_data: data.form_data as never,
      })
      .eq("id", data.run_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const completeSchema = z.object({
  run_id: z.string().uuid(),
  entity_id: z.string().uuid(),
});

export const completeOnbRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => completeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: run, error: rErr } = await supabase
      .from("onboarding_runs")
      .select("id, template_id, entity_type, owner_id")
      .eq("id", data.run_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!run) throw new Error("Onboarding run não encontrado.");

    let tasksCreated = 0;
    let workflowEnqueued = false;

    if (run.template_id) {
      const { data: tpl } = await supabase
        .from("onboarding_templates")
        .select("tasks_template, workflow_id, entity_type")
        .eq("id", run.template_id)
        .maybeSingle();
      const tasks = ((tpl?.tasks_template as OnbTaskTemplate[] | null) ?? []) as OnbTaskTemplate[];

      const entityCol =
        run.entity_type === "lead"
          ? "lead_id"
          : run.entity_type === "company"
            ? "company_id"
            : "contact_id";

      if (tasks.length > 0) {
        const now = new Date();
        const rows = tasks.map((t) => {
          const due = new Date(now);
          due.setDate(due.getDate() + t.offset_days);
          return {
            owner_id: userId,
            created_by: userId,
            type: t.type,
            subject: t.title,
            body: t.body ?? null,
            due_date: due.toISOString(),
            [entityCol]: data.entity_id,
          };
        });
        const { error: aErr } = await (
          supabase as unknown as {
            from: (t: string) => {
              insert: (r: unknown) => Promise<{ error: { message: string } | null }>;
            };
          }
        )
          .from("activities")
          .insert(rows);
        if (!aErr) tasksCreated = rows.length;
      }

      if (tpl?.workflow_id) {
        const { error: evErr } = await supabase.from("workflow_events").insert({
          owner_id: userId,
          entity:
            run.entity_type === "lead"
              ? "leads"
              : run.entity_type === "company"
                ? "companies"
                : "contacts",
          entity_id: data.entity_id,
          event_type: "created",
          after: { onboarded_via: run.template_id } as never,
          before: null,
        } as never);
        if (!evErr) workflowEnqueued = true;
      }
    }

    const { error: uErr } = await supabase
      .from("onboarding_runs")
      .update({
        entity_id: data.entity_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.run_id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, tasks_created: tasksCreated, workflow_enqueued: workflowEnqueued };
  });

export const cancelOnbRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ run_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("onboarding_runs")
      .update({ status: "cancelled" })
      .eq("id", data.run_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Presets padrão exibidos ao criar um template do zero. */
export const ONB_PRESETS: Record<
  OnbEntityType,
  { name: string; steps: OnbStep[]; tasks: OnbTaskTemplate[] }
> = {
  lead: {
    name: "Onboarding padrão de Lead",
    steps: [
      {
        id: "identity",
        title: "Identificação",
        description: "Dados básicos para contato",
        fields: [
          {
            name: "first_name",
            label: "Nome",
            type: "text",
            required: true,
            target_column: "first_name",
          },
          { name: "last_name", label: "Sobrenome", type: "text", target_column: "last_name" },
          { name: "email", label: "E-mail", type: "email", target_column: "email" },
          { name: "phone", label: "Telefone", type: "phone", target_column: "phone" },
        ],
      },
      {
        id: "context",
        title: "Contexto",
        description: "Empresa e origem",
        fields: [
          { name: "company_name", label: "Empresa", type: "text", target_column: "company_name" },
          { name: "source", label: "Origem", type: "text", target_column: "source" },
        ],
      },
      {
        id: "qualification",
        title: "Qualificação",
        fields: [
          {
            name: "notes",
            label: "Notas iniciais",
            type: "textarea",
            help: "Contexto da conversa, dor, urgência",
            target_column: "notes",
          },
        ],
      },
    ],
    tasks: [
      { title: "Ligar para qualificar", type: "call", offset_days: 0 },
      { title: "Enviar apresentação por e-mail", type: "email", offset_days: 1 },
      { title: "Agendar reunião de descoberta", type: "meeting", offset_days: 3 },
    ],
  },
  company: {
    name: "Onboarding padrão de Empresa",
    steps: [
      {
        id: "identity",
        title: "Identificação",
        fields: [
          {
            name: "name",
            label: "Razão social / Nome",
            type: "text",
            required: true,
            target_column: "name",
          },
          { name: "cnpj", label: "CNPJ", type: "text", target_column: "cnpj" },
          { name: "website", label: "Website", type: "text", target_column: "website" },
        ],
      },
      {
        id: "context",
        title: "Contexto",
        fields: [
          { name: "industry", label: "Setor", type: "text", target_column: "industry" },
          {
            name: "employees",
            label: "Nº de funcionários",
            type: "number",
            target_column: "employees",
          },
          {
            name: "annual_revenue",
            label: "Faturamento anual",
            type: "number",
            target_column: "annual_revenue",
          },
        ],
      },
    ],
    tasks: [
      { title: "Confirmar enriquecimento por CNPJ", type: "task", offset_days: 0 },
      { title: "Mapear stakeholders principais", type: "task", offset_days: 2 },
    ],
  },
  contact: {
    name: "Onboarding padrão de Contato",
    steps: [
      {
        id: "identity",
        title: "Identificação",
        fields: [
          {
            name: "first_name",
            label: "Nome",
            type: "text",
            required: true,
            target_column: "first_name",
          },
          { name: "last_name", label: "Sobrenome", type: "text", target_column: "last_name" },
          { name: "email", label: "E-mail", type: "email", target_column: "email" },
          { name: "phone", label: "Telefone", type: "phone", target_column: "phone" },
        ],
      },
      {
        id: "role",
        title: "Papel na empresa",
        fields: [
          { name: "job_title", label: "Cargo", type: "text", target_column: "job_title" },
          { name: "department", label: "Departamento", type: "text", target_column: "department" },
        ],
      },
    ],
    tasks: [
      { title: "Conectar no LinkedIn", type: "task", offset_days: 0 },
      { title: "Follow-up de primeiro contato", type: "email", offset_days: 2 },
    ],
  },
};
