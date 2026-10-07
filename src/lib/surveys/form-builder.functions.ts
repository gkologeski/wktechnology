// Construtor de pesquisas: rascunho com controle de conflito, publicação versionada.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import type { Json } from "@/integrations/supabase/types";
import { FormSchemaZ } from "@/lib/surveys/form-schema-zod";
import { schemaFromLegacy, validateSchema, type FormSchema } from "@/lib/surveys/form-schema";

export const getFormDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: t, error } = await context.supabase
      .from("survey_templates")
      .select(
        "id, name, description, kind, draft_schema, draft_revision, published_version, scoring_enabled, is_active",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Pesquisa não encontrada.");
    let schema = t.draft_schema as unknown as FormSchema | null;
    if (!schema && t.published_version) {
      const { data: v } = await context.supabase
        .from("survey_template_versions")
        .select("schema")
        .eq("template_id", t.id)
        .eq("version", t.published_version)
        .maybeSingle();
      schema = (v?.schema as unknown as FormSchema) ?? null;
    }
    if (!schema) {
      const { data: rows } = await context.supabase
        .from("survey_template_questions")
        .select(
          "id, field_key, label, help_text, type, options, settings, required, scored, weight, conditions",
        )
        .eq("survey_template_id", t.id)
        .order("position");
      schema = schemaFromLegacy(t.name, (rows ?? []) as never, t.scoring_enabled);
      schema.description = t.description ?? undefined;
    }
    return {
      id: t.id,
      kind: t.kind,
      isActive: t.is_active,
      revision: t.draft_revision,
      publishedVersion: t.published_version,
      schema: schema as unknown as Json,
    };
  });

export const createFormTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ schema: FormSchemaZ }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("survey_templates")
      .insert({
        owner_id: context.userId,
        workspace_id: ws,
        name: data.schema.title,
        description: data.schema.description ?? null,
        kind: "form",
        scope: "activity",
        trigger_event: "manual",
        channel: "email",
        is_active: false,
        scoring_enabled: data.schema.scoringEnabled,
        draft_schema: data.schema as unknown as Json,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Salva rascunho. Falha com conflito se outra pessoa salvou antes (revisão diferente). */
export const saveFormDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), revision: z.number().int().min(0), schema: FormSchemaZ })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_templates")
      .update({
        draft_schema: data.schema as unknown as Json,
        draft_revision: data.revision + 1,
        name: data.schema.title,
        description: data.schema.description ?? null,
      } as never)
      .eq("id", data.id)
      .eq("draft_revision", data.revision)
      .select("draft_revision");
    if (error) throw new Error(error.message);
    if (!rows?.length)
      throw new Error(
        "CONFLITO: esta pesquisa foi alterada em outra aba ou por outra pessoa. Recarregue antes de salvar.",
      );
    return { revision: data.revision + 1 };
  });

/** Publica: valida, grava versão imutável e sincroniza perguntas legadas. Não dispara envios. */
export const publishForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), activate: z.boolean().default(true) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ws = await getActiveWorkspaceId(supabase, userId);
    const { data: t, error } = await supabase
      .from("survey_templates")
      .select("id, draft_schema, published_version")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t?.draft_schema) throw new Error("Salve o rascunho antes de publicar.");
    const schema = FormSchemaZ.parse(t.draft_schema) as FormSchema;
    const issues = validateSchema(schema);
    if (issues.length) throw new Error(issues.join(" "));
    const version = (t.published_version ?? 0) + 1;
    const { error: vErr } = await supabase.from("survey_template_versions").insert({
      workspace_id: ws,
      template_id: t.id,
      version,
      schema: schema as unknown as Json,
      created_by: userId,
    } as never);
    if (vErr)
      throw new Error(
        vErr.message.includes("duplicate")
          ? "Outra publicação já ocorreu. Recarregue."
          : vErr.message,
      );

    // Sincroniza tabela legada (leituras antigas). Mantém ids por field_key.
    const { data: existing } = await supabase
      .from("survey_template_questions")
      .select("id, field_key")
      .eq("survey_template_id", t.id);
    const byKey = new Map((existing ?? []).map((r) => [r.field_key, r.id]));
    const keys = new Set(schema.fields.map((f) => f.id));
    const stale = (existing ?? []).filter((r) => !keys.has(r.field_key ?? "")).map((r) => r.id);
    if (stale.length) await supabase.from("survey_template_questions").delete().in("id", stale);
    for (const [position, f] of schema.fields.entries()) {
      const row = {
        survey_template_id: t.id,
        owner_id: userId,
        workspace_id: ws,
        field_key: f.id,
        label: f.label,
        help_text: f.description ?? null,
        type: f.type,
        options: (f.options ?? []) as unknown as Json,
        settings: {
          min: f.min,
          max: f.max,
          min_label: f.minLabel,
          max_label: f.maxLabel,
          stars: f.stars,
          placeholder: f.placeholder,
        } as unknown as Json,
        required: !!f.required,
        scored: !!f.scored,
        weight: f.weight ?? 1,
        conditions: (f.showIf ?? null) as unknown as Json,
        position,
      };
      const id = byKey.get(f.id);
      const q = id
        ? supabase
            .from("survey_template_questions")
            .update(row as never)
            .eq("id", id)
        : supabase.from("survey_template_questions").insert(row as never);
      const { error: qErr } = await q;
      if (qErr) throw new Error(qErr.message);
    }
    const { error: uErr } = await supabase
      .from("survey_templates")
      .update({
        published_version: version,
        scoring_enabled: schema.scoringEnabled,
        is_active: data.activate,
        name: schema.title,
      } as never)
      .eq("id", t.id);
    if (uErr) throw new Error(uErr.message);
    return { version };
  });
