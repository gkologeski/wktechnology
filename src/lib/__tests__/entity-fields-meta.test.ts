import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FIELD_ALIASES,
  LEGACY_SYSTEM_FIELDS,
  canonicalOf,
  isLegacyAlias,
  toLabel,
} from "@/lib/entity-fields-meta";
import { dedupeAliasFields, findAliasConflict } from "@/lib/grid/field-alias-guard";
import { ENTITY_FIELDS } from "@/lib/workflows/types";
import { sortFieldsByCanonicalOrder } from "@/lib/workflows/entity-field-order";
import { WORK_COST_PUBLIC_COLUMNS } from "@/lib/access-control/work-cost-projection";

/**
 * Colunas reais (subconjunto relevante) por entidade, conferidas no banco.
 * Serve de guarda contra rótulos duplicados no catálogo de campos.
 */
const ENTITY_COLUMNS: Record<string, string[]> = {
  leads: [
    "name",
    "email",
    "phone",
    "company_id",
    "company_name",
    "assigned_to",
    "assigned_user_id",
    "status",
    "stage",
    "source",
  ],
  contacts: [
    "first_name",
    "last_name",
    "email",
    "company_id",
    "company_name",
    "assigned_to",
    "assigned_user_id",
    "job_title",
  ],
  companies: ["name", "cnpj", "assigned_to", "assigned_user_id", "industry", "website"],
  deals: ["name", "value", "company_id", "assigned_to", "assigned_user_id", "stage", "pipeline_id"],
  tickets: ["subject", "assignee_id", "contact_id", "company_id", "priority", "status"],
  project_tasks: ["title", "assignee_id", "project_id", "due_at", "status"],
  proposals: ["title", "company_id", "contact_id", "deal_id", "assigned_to", "status"],
  quotes: ["title", "company_id", "contact_id", "deal_id", "assigned_to", "status"],
  contracts: ["title", "deal_id", "assigned_to", "total_value", "start_at", "end_at"],
};

function catalog(entity: string) {
  return dedupeAliasFields(
    ENTITY_COLUMNS[entity]!.map((name) => ({
      name,
      label: toLabel(name, entity),
      system: LEGACY_SYSTEM_FIELDS.has(name) || undefined,
    })),
  );
}

describe("entity field labels", () => {
  it.each(Object.keys(ENTITY_COLUMNS))(
    "%s não tem rótulos duplicados entre campos visíveis",
    (entity) => {
      const visible = catalog(entity).filter((f) => !f.system);
      const labels = visible.map((f) => f.label);
      expect(new Set(labels).size).toBe(labels.length);
    },
  );

  it("aliases legados têm rótulo distinto do canônico e são campos de sistema", () => {
    for (const [alias, canonical] of Object.entries(FIELD_ALIASES)) {
      expect(toLabel(alias)).not.toBe(toLabel(canonical));
      expect(LEGACY_SYSTEM_FIELDS.has(alias)).toBe(true);
      expect(isLegacyAlias(canonical)).toBe(false);
      expect(canonicalOf(alias)).toBe(canonical);
    }
  });

  it("mantém os rótulos canônicos limpos", () => {
    expect(toLabel("company_id")).toBe("Empresa");
    expect(toLabel("assigned_to")).toBe("Responsável");
  });
});

describe("field alias guard", () => {
  it("marca alias como campo de sistema mesmo se o rótulo colidir", () => {
    const fields = dedupeAliasFields<{ name: string; label: string; system?: boolean }>([
      { name: "company_id", label: "Empresa" },
      { name: "company_name", label: "Empresa" },
    ]);
    expect(fields.find((f) => f.name === "company_id")?.system).toBeFalsy();
    expect(fields.find((f) => f.name === "company_name")?.system).toBe(true);
  });

  it("detecta seleção simultânea de alias e canônico", () => {
    const fields = [
      { name: "assigned_to", label: "Responsável" },
      { name: "assigned_user_id", label: "Responsável (legado)" },
    ];
    expect(findAliasConflict(["assigned_to", "assigned_user_id"], fields)).toMatchObject({
      alias: "assigned_user_id",
      canonical: "assigned_to",
    });
    expect(findAliasConflict(["assigned_to"], fields)).toBeNull();
  });
});

describe("project workflow field suggestions", () => {
  // Generated database row metadata is independent of the fallback/order lists.
  // A misspelled suggestion must fail against the persisted source shape.
  const source = readFileSync(
    new URL("../../integrations/supabase/types.ts", import.meta.url),
    "utf8",
  );
  const resources = [
    { entity: "projects", title: "name", dates: ["starts_at", "due_at"] },
    { entity: "project_tasks", title: "title", dates: ["start_at", "due_at"] },
    { entity: "project_milestones", title: "name", dates: ["due_at"] },
  ] as const;

  it.each(resources)(
    "offers persisted $entity fields while metadata is unavailable",
    ({ entity, title, dates }) => {
      const row = new RegExp(`^ {6}${entity}: \\{\\n {8}Row: \\{([\\s\\S]*?)^ {8}\\}`, "m").exec(
        source,
      )?.[1];
      expect(row, "Missing canonical database metadata for " + entity).toBeDefined();
      const columns = new Set([...row!.matchAll(/^ {10}(\w+):/gm)].map((match) => match[1]));
      expect(columns.size).toBeGreaterThan(0);
      expect(ENTITY_FIELDS[entity].filter((name) => !columns.has(name))).toEqual([]);
      if (entity === "projects") {
        const publicColumns = new Set(WORK_COST_PUBLIC_COLUMNS.projects.split(","));
        expect(ENTITY_FIELDS.projects.filter((name) => !publicColumns.has(name))).toEqual([]);
      }
      expect(ENTITY_FIELDS[entity]).toContain(title);
      expect(ENTITY_FIELDS[entity]).toContain("status");
      expect(ENTITY_FIELDS[entity]).toContain("due_at");
      const supplied = [
        { name: "future_extension" },
        ...dates.map((name) => ({ name })),
        { name: "status" },
        { name: title },
        { name: "due_date" },
      ];
      const original = structuredClone(supplied);
      expect(sortFieldsByCanonicalOrder(entity, supplied).map(({ name }) => name)).toEqual([
        title,
        "status",
        ...dates,
        "future_extension",
        "due_date",
      ]);
      // Existing unknown/legacy keys remain present; only suggestion/order changes.
      expect(supplied).toEqual(original);
    },
  );

  it("describes the persisted task title as a task title rather than a contact job title", () => {
    expect(toLabel("title", "project_tasks")).toBe("Título da tarefa");
    expect(toLabel("title", "project_tasks")).not.toBe(toLabel("title", "contacts"));
  });
});
