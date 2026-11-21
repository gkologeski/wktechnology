import { describe, expect, it, vi } from "vitest";
import { hydrateTriggerAssociations } from "./hydrate-associations.server";
import { renderWorkflowTokens } from "./render-tokens";

function privilegedProjectReader() {
  const project = {
    id: "project-1",
    workspace_id: "workspace",
    name: "Delivery",
    status: "active",
    due_at: "2026-12-20",
    planned_hours: 20,
    planned_cost: 75000,
  };
  let selection = "";
  const read = vi.fn(() => ({
    select: (columns: string) => {
      selection = columns;
      return {
        eq: () => ({
          maybeSingle: async () => ({
            data:
              columns === "*"
                ? project
                : Object.fromEntries(
                    Object.entries(project).filter(([name]) => columns.split(",").includes(name)),
                  ),
            error: null,
          }),
        }),
      };
    },
  }));
  return { client: { from: read } as never, read, selection: () => selection };
}

describe("privileged workflow association projection", () => {
  it("resolves project business tokens without selecting or rendering confidential cost", async () => {
    const db = privilegedProjectReader();
    const source = { id: "task-1", project_id: "project-1", title: "Task" };
    const hydrated = await hydrateTriggerAssociations(
      db.client,
      "project_tasks",
      source,
      JSON.stringify({ title: "{{project.name}} {{project.planned_cost}}" }),
    );
    expect(db.read).toHaveBeenCalledExactlyOnceWith("projects");
    expect(db.selection().split(",")).not.toContain("planned_cost");
    expect(
      renderWorkflowTokens(
        "{{project.name}}|{{project.planned_hours}}|{{project.planned_cost}}",
        hydrated,
      ),
    ).toBe("Delivery|20|");
    expect(hydrated?.project).toMatchObject({ name: "Delivery", due_at: "2026-12-20" });
    expect(source).toEqual({ id: "task-1", project_id: "project-1", title: "Task" });
  });

  it("projects an old project source even when no association needs hydration", async () => {
    const db = privilegedProjectReader();
    const source = { name: "Delivery", planned_cost: 75000, planned_hours: 20 };
    expect(await hydrateTriggerAssociations(db.client, "projects", source, "{}")).toEqual({
      name: "Delivery",
      planned_hours: 20,
    });
    expect(db.read).not.toHaveBeenCalled();
    expect(source.planned_cost).toBe(75000);
  });

  it("retains a same-named business value belonging to another module", async () => {
    const db = privilegedProjectReader();
    const source = { description: "Financial planning", planned_cost: 75000 };
    const hydrated = await hydrateTriggerAssociations(db.client, "financial_entries", source, "{}");
    expect(renderWorkflowTokens("{{planned_cost}}", hydrated)).toBe("75000");
    expect(hydrated).toEqual(source);
    expect(db.read).not.toHaveBeenCalled();
  });

  it("never hydrates HR identities into a named occurrence even when its template asks for them", async () => {
    const db = privilegedProjectReader();
    const source = {
      id: "application",
      workspace_id: "workspace",
      job_id: "job",
      candidate_id: "candidate",
      status: "new",
      full_name: "Private identity",
      hiring_details: { amount: 9000 },
      candidate: { full_name: "Private identity" },
    };
    const safe = await hydrateTriggerAssociations(
      db.client,
      "ats_applications",
      source,
      JSON.stringify({ text: "{{candidate.full_name}} {{hiring_details.amount}}" }),
      "ats.application.received",
    );
    expect(db.read).not.toHaveBeenCalled();
    expect(safe).toEqual({
      id: "application",
      workspace_id: "workspace",
      job_id: "job",
      candidate_id: "candidate",
      status: "new",
    });
    expect(
      renderWorkflowTokens("{{candidate.full_name}}|{{hiring_details.amount}}|{{status}}", safe),
    ).toBe("||new");
    expect(source.hiring_details.amount).toBe(9000);
  });

  it("projects read-only document snapshots even without an event key and never renders document contents", async () => {
    const db = privilegedProjectReader();
    const safe = await hydrateTriggerAssociations(
      db.client,
      "people_documents",
      {
        id: "document",
        person_id: "person",
        expires_at: "2026-12-20",
        status: "valid",
        doc_type: "Private document",
        doc_number: "Sensitive number",
        file_url: "private/path",
        file_name: "private.pdf",
        notes: "Private note",
      },
      "{}",
    );
    expect(safe).toEqual({
      id: "document",
      person_id: "person",
      expires_at: "2026-12-20",
      status: "valid",
    });
    expect(renderWorkflowTokens("{{file_url}}|{{doc_number}}|{{expires_at}}", safe)).toBe(
      "||2026-12-20",
    );
    expect(db.read).not.toHaveBeenCalled();
  });
});

describe("minimal financial occurrence hydration", () => {
  it("never hydrates privileged bank/legal entity data for a financial notice and keeps generic amounts compatible", async () => {
    const db = privilegedProjectReader();
    const source = {
      id: "entry",
      workspace_id: "workspace",
      owner_id: "owner",
      direction: "payable",
      status: "partial",
      due_date: "2026-11-20",
      amount: 1234,
      paid_amount: 500,
      description: "private invoice",
      notes: "private note",
      metadata: { pix_key: "private" },
      attachments: ["private/path"],
      legal_entity_id: "entity",
      bank_account_id: "bank",
    };
    const safe = await hydrateTriggerAssociations(
      db.client,
      "financial_entries",
      source,
      JSON.stringify({ title: "{{bank_account.name}} {{legal_entity.payments_settings}}" }),
      "finance.payable.due",
    );
    expect(safe).toEqual({
      id: "entry",
      workspace_id: "workspace",
      owner_id: "owner",
      direction: "payable",
      status: "partial",
      due_date: "2026-11-20",
    });
    expect(db.read).not.toHaveBeenCalled();
    const generic = await hydrateTriggerAssociations(db.client, "financial_entries", source, "{}");
    expect(generic?.amount).toBe(1234);
    expect(source.amount).toBe(1234);
  });

  it("always minimizes the readonly fiscal source without requesting private rows or resolving file tokens", async () => {
    const db = privilegedProjectReader();
    const safe = await hydrateTriggerAssociations(
      db.client,
      "hiring_fiscal_documents",
      {
        id: "fiscal",
        request_id: "request",
        doc_type: "nfse",
        status: "registered",
        registered_at: "2026-11-20T14:00:00Z",
        issued_on: "2026-11-01",
        amount: 9999,
        file_name: "invoice.pdf",
        storage_path: "private/path",
        sha256: "privatehash",
        issuer_tax_id: "privateid",
        document_number: "private-number",
      },
      "{}",
    );
    expect(safe).toEqual({
      id: "fiscal",
      request_id: "request",
      doc_type: "nfse",
      status: "registered",
      registered_at: "2026-11-20T14:00:00Z",
      issued_on: "2026-11-01",
    });
    expect(
      renderWorkflowTokens("{{storage_path}}|{{document_number}}|{{registered_at}}", safe),
    ).toBe("||2026-11-20T14:00:00Z");
    expect(db.read).not.toHaveBeenCalled();
  });
});
