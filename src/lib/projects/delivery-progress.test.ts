import { describe, expect, it } from "vitest";
import {
  PROGRESS_VALIDATION_MESSAGE,
  formatProgressInputValue,
  formatProgressPct,
  normalizeProgressValue,
  parseCheckpointInput,
  parseCheckpointPatchInput,
  parseProgressInput,
  progressPctSchema,
} from "./delivery-progress";

const VALID_PROJECT_ID = "72834706-8849-4ae8-abdb-700ebd73f950";
const VALID_UPDATE_ID = "6c798019-72a3-4cbe-98ab-779642f9fb02";

describe("delivery-progress", () => {
  it("accepts decimals with up to 2 places including 34.3 and 34.25", () => {
    expect(progressPctSchema.parse(34.3)).toBe(34.3);
    expect(progressPctSchema.parse(34.25)).toBe(34.25);
    expect(progressPctSchema.parse(0)).toBe(0);
    expect(progressPctSchema.parse(100)).toBe(100);
    expect(progressPctSchema.parse(0.29)).toBe(0.29);
    expect(progressPctSchema.parse(57.29)).toBe(57.29);
  });

  it("rejects out-of-range and over-precision values with PT-BR message", () => {
    for (const invalid of [100.01, -1, -0.01, 34.333, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = progressPctSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(PROGRESS_VALIDATION_MESSAGE);
      }
    }
  });

  it("throws a clean PT-BR error from checkpoint parsers instead of raw Zod JSON", () => {
    expect(
      parseCheckpointInput({
        projectId: VALID_PROJECT_ID,
        title: "Marco de acompanhamento",
        progressPct: 34.3,
      }).progressPct,
    ).toBe(34.3);

    expect(() =>
      parseCheckpointInput({
        projectId: VALID_PROJECT_ID,
        title: "Marco de acompanhamento",
        progressPct: 100.01,
      }),
    ).toThrow(PROGRESS_VALIDATION_MESSAGE);

    expect(() =>
      parseCheckpointPatchInput({
        id: VALID_UPDATE_ID,
        progressPct: -1,
      }),
    ).toThrow(PROGRESS_VALIDATION_MESSAGE);
  });

  it("parses Brazilian comma and dot decimal inputs cleanly", () => {
    expect(parseProgressInput("")).toEqual({ ok: true, value: null });
    expect(parseProgressInput("   ")).toEqual({ ok: true, value: null });
    expect(parseProgressInput("34,3")).toEqual({ ok: true, value: 34.3 });
    expect(parseProgressInput("34,25")).toEqual({ ok: true, value: 34.25 });
    expect(parseProgressInput("34.3")).toEqual({ ok: true, value: 34.3 });
    expect(parseProgressInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseProgressInput("100")).toEqual({ ok: true, value: 100 });

    for (const raw of ["100,01", "-1", "34,333", "34,3,1", "abc"]) {
      expect(parseProgressInput(raw)).toEqual({ ok: false, error: PROGRESS_VALIDATION_MESSAGE });
    }
  });

  it("formats percentages in pt-BR and normalizes DB numeric values", () => {
    expect(formatProgressPct(34.3)).toBe("34,3");
    expect(formatProgressPct(34.25)).toBe("34,25");
    expect(formatProgressPct(34.3)).toBe("34,3");
    expect(formatProgressPct(100)).toBe("100");
    expect(formatProgressPct(0)).toBe("0");

    expect(formatProgressInputValue(34.3)).toBe("34,3");
    expect(formatProgressInputValue(null)).toBe("");
    expect(formatProgressInputValue(undefined)).toBe("");

    expect(normalizeProgressValue("34.30")).toBe(34.3);
    expect(normalizeProgressValue(34.25)).toBe(34.25);
    expect(normalizeProgressValue(null)).toBeNull();
  });
});
