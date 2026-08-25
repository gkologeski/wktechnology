// Server fns para importação de CSV com dedupe em leads, contacts e companies.
// Fluxo: cliente parseia CSV (papaparse) → envia rows + mapping → server valida,
// faz dedupe pela chave selecionada e aplica skip/update/create.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertImportEntity } from "@/lib/access-control/admin-gates.server";

export type CsvEntity = "leads" | "contacts" | "companies";
export type DedupeStrategy = "skip" | "update" | "create_new";

export const ENTITY_FIELDS: Record<
  CsvEntity,
  { key: string; label: string; required?: boolean }[]
> = {
  leads: [
    { key: "first_name", label: "Nome", required: true },
    { key: "last_name", label: "Sobrenome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "company_name", label: "Empresa" },
    { key: "source", label: "Origem" },
    { key: "notes", label: "Notas" },
  ],
  contacts: [
    { key: "first_name", label: "Nome", required: true },
    { key: "last_name", label: "Sobrenome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "mobile_phone", label: "Celular" },
    { key: "job_title", label: "Cargo" },
    { key: "company_name", label: "Empresa" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "Estado" },
    { key: "country", label: "País" },
    { key: "linkedin_url", label: "LinkedIn" },
    { key: "notes", label: "Notas" },
  ],
  companies: [
    { key: "name", label: "Nome", required: true },
    { key: "domain", label: "Domínio" },
    { key: "website", label: "Website" },
    { key: "industry", label: "Setor" },
    { key: "size", label: "Tamanho" },
    { key: "phone", label: "Telefone" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "Estado" },
    { key: "country", label: "País" },
    { key: "description", label: "Descrição" },
  ],
};

export const DEDUPE_KEYS: Record<CsvEntity, string[]> = {
  leads: ["email"],
  contacts: ["email"],
  companies: ["domain", "name"],
};

async function getActiveWorkspaceId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
  if (activeId) return activeId;
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const id = (m as { workspace_id?: string } | null)?.workspace_id;
  if (!id) throw new Error("Nenhum workspace ativo.");
  return id;
}

const entitySchema = z.enum(["leads", "contacts", "companies"]);
const strategySchema = z.enum(["skip", "update", "create_new"]);

// Cada row do CSV vira um Record<string,string>. Limitamos tamanho para evitar DoS.
const rowSchema = z
  .record(z.string().max(120), z.string().max(2000).nullable())
  .refine((r) => Object.keys(r).length <= 200);
const rowsSchema = z.array(rowSchema).min(1).max(5000);
const mappingSchema = z.record(z.string().min(1).max(120), z.string().min(1).max(120));

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function buildRecord(
  entity: CsvEntity,
  row: Record<string, string | null>,
  mapping: Record<string, string>,
) {
  const out: Record<string, unknown> = {};
  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const raw = row[csvCol];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = String(raw).trim();
    if (!value) continue;
    out[fieldKey] = value;
  }
  // Para leads/contacts, garantir first_name (se ausente mas tem email, deriva).
  if ((entity === "leads" || entity === "contacts") && !out.first_name) {
    if (typeof out.email === "string") out.first_name = out.email.split("@")[0];
  }
  return out;
}

export const previewCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: entitySchema,
        rows: rowsSchema,
        mapping: mappingSchema,
        dedupeKey: z.string().min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await getActiveWorkspaceId(context.userId);
    const { entity, rows, mapping, dedupeKey } = data;

    // Construir records e extrair valores da chave dedupe
    const records = rows.map((r) => buildRecord(entity, r, mapping));
    const keyValues = Array.from(
      new Set(
        records
          .map((r) => normalize(r[dedupeKey] as string | undefined))
          .filter((v) => v.length > 0),
      ),
    );

    // Buscar existentes no workspace
    const existing = new Map<string, string>(); // key value → id
    if (keyValues.length > 0) {
      const { data: found, error } = await context.supabase
        .from(entity)
        .select(`id, ${dedupeKey}`)
        .eq("workspace_id", workspaceId)
        .in(dedupeKey, keyValues);
      if (error) throw new Error(error.message);
      for (const row of (found ?? []) as unknown as Array<Record<string, string>>) {
        existing.set(normalize(row[dedupeKey]), row.id);
      }
    }

    let duplicates = 0;
    let creates = 0;
    let invalid = 0;
    const required = ENTITY_FIELDS[entity].filter((f) => f.required).map((f) => f.key);
    for (const r of records) {
      const missing = required.some((k) => !r[k]);
      if (missing) {
        invalid++;
        continue;
      }
      const k = normalize(r[dedupeKey] as string | undefined);
      if (k && existing.has(k)) duplicates++;
      else creates++;
    }
    return {
      totalRows: rows.length,
      validRows: creates + duplicates,
      invalidRows: invalid,
      newRecords: creates,
      duplicates,
    };
  });

export const executeCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: entitySchema,
        rows: rowsSchema,
        mapping: mappingSchema,
        dedupeKey: z.string().min(1).max(60),
        strategy: strategySchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertImportEntity(context.supabase, context.userId, data.entity);
    const workspaceId = await getActiveWorkspaceId(context.userId);
    const { entity, rows, mapping, dedupeKey, strategy } = data;

    const records = rows.map((r) => buildRecord(entity, r, mapping));
    const keyValues = Array.from(
      new Set(
        records
          .map((r) => normalize(r[dedupeKey] as string | undefined))
          .filter((v) => v.length > 0),
      ),
    );

    const existing = new Map<string, string>();
    if (keyValues.length > 0) {
      const { data: found, error } = await context.supabase
        .from(entity)
        .select(`id, ${dedupeKey}`)
        .eq("workspace_id", workspaceId)
        .in(dedupeKey, keyValues);
      if (error) throw new Error(error.message);
      for (const row of (found ?? []) as unknown as Array<Record<string, string>>) {
        existing.set(normalize(row[dedupeKey]), row.id);
      }
    }

    const required = ENTITY_FIELDS[entity].filter((f) => f.required).map((f) => f.key);
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: Array<{ id: string; values: Record<string, unknown> }> = [];
    let skipped = 0;
    let invalid = 0;
    for (const r of records) {
      if (required.some((k) => !r[k])) {
        invalid++;
        continue;
      }
      const k = normalize(r[dedupeKey] as string | undefined);
      const existingId = k ? existing.get(k) : undefined;
      if (existingId) {
        if (strategy === "skip") {
          skipped++;
          continue;
        }
        if (strategy === "update") {
          toUpdate.push({ id: existingId, values: r });
          continue;
        }
        // create_new: insere mesmo se duplicado
      }
      // owner_id é setado abaixo
      toInsert.push({ ...r, owner_id: context.userId });
    }

    let inserted = 0;
    let updated = 0;
    if (toInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error, count } = await context.supabase
          .from(entity)
          .insert(chunk as never, { count: "exact" });
        if (error) throw new Error(error.message);
        inserted += count ?? chunk.length;
      }
    }
    if (toUpdate.length > 0) {
      for (const { id, values } of toUpdate) {
        const { error } = await context.supabase
          .from(entity)
          .update(values as never)
          .eq("id", id)
          .eq("workspace_id", workspaceId);
        if (error) throw new Error(error.message);
        updated++;
      }
    }
    return { inserted, updated, skipped, invalid };
  });
