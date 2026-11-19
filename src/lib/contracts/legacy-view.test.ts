import { describe, expect, it } from "vitest";
import {
  legacyGate,
  legacyMode,
  regularizeBlockers,
  latestLegacyEvidence,
  missingBeforeRegularize,
  type LegacyState,
} from "./legacy-view";

const state = (record: LegacyState["record"], problem: string | null = null): LegacyState => ({
  contract_id: "c",
  eligible_problem: problem,
  record,
  events: [],
  evidence: [],
});
const rec = (status: "pending" | "regularized", stale = false) => ({
  id: "r",
  status,
  revision: 1,
  situation: null,
  stale,
  recognized_at: "2026-11-19",
  regularized_at: null,
});

describe("legacy view mode", () => {
  it("load failure is an error, never a false non-legacy", () => {
    const m = legacyMode({ isLoading: false, isError: true });
    expect(m).toBe("error");
    expect(legacyGate(m)).toBe("unknown");
  });
  it("loading also hides signature flows", () => {
    expect(legacyGate(legacyMode({ isLoading: true, isError: false }))).toBe("unknown");
  });
  it("maps eligibility, pending, stale and regularized", () => {
    const g = (s: LegacyState) =>
      legacyMode({ isLoading: false, isError: false, data: { access: "granted", state: s } });
    expect(g(state(null))).toBe("eligible");
    expect(g(state(null, "Contrato com assinatura em curso"))).toBe("ineligible");
    expect(legacyGate(g(state(rec("pending"))))).toBe("pending");
    expect(g(state(rec("pending", true)))).toBe("stale");
    expect(legacyGate(g(state(rec("regularized"))))).toBe("regularized");
  });
});

describe("regularize form blockers", () => {
  const ok = {
    situation: "in_force" as const,
    signedOn: "2023-03-10",
    signatureConfirmed: true,
    startsOn: "2023-03-15",
    endsOn: null,
    terminatedOn: null,
    autoRenew: false,
    autoRenewConfirmed: false,
    externalReference: "Pasta 2023",
    reason: "Original conferido",
    evidenceReady: true,
  };
  it("complete human review has no blockers", () => {
    expect(regularizeBlockers(ok, "2026-11-19")).toEqual([]);
  });
  it("future validity stays pending with explanation", () => {
    expect(regularizeBlockers({ ...ok, startsOn: "2027-01-01" }, "2026-11-19").join(" ")).toMatch(
      /Vigência futura/,
    );
  });
  it("signature must be confirmed by a human and renewal conferred", () => {
    expect(regularizeBlockers({ ...ok, signatureConfirmed: false }, "2026-11-19").length).toBe(1);
    expect(regularizeBlockers({ ...ok, autoRenew: true }, "2026-11-19").join(" ")).toMatch(
      /renovação/,
    );
    expect(regularizeBlockers({ ...ok, evidenceReady: false }, "2026-11-19").join(" ")).toMatch(
      /PDF/,
    );
  });
});

it("legacy classification keeps common readers out of new commercial signing without evidence access", () => {
  for (const classification of ["pending", "regularized"] as const) {
    const mode = legacyMode({
      isLoading: false,
      isError: false,
      data: { access: "denied", classification },
    });
    expect(legacyGate(mode)).toBe(classification);
  }
  expect(
    legacyGate(
      legacyMode({
        isLoading: false,
        isError: false,
        data: { access: "denied", classification: null },
      }),
    ),
  ).toBe("none");
});

it("regularization uses the latest attested file of the current revision", () => {
  const file = (id: string, revision: number, status: "attested" | "superseded") => ({
    id,
    revision,
    status,
    file_name: id + ".pdf",
    sha256: id,
    size: 10,
  });
  const docs = [
    file("old", 1, "attested"),
    file("new", 1, "attested"),
    file("other-revision", 2, "attested"),
    file("cancelled", 1, "superseded"),
  ];
  expect(latestLegacyEvidence(docs, 1)?.id).toBe("new");
  expect(latestLegacyEvidence(docs, 3)).toBeNull();
});
it("a scanned legacy does not require a fabricated editable draft body", () => {
  expect(
    missingBeforeRegularize({
      counterparty_company_id: "c",
      contracting_legal_entity_id: "wk",
      source_file_path: "original.pdf",
      body_html: null,
    }),
  ).toEqual([]);
});
