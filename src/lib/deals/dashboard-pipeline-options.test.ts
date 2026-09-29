import { describe, expect, it } from "vitest";
import {
  buildDashboardPipelineOptions,
  DEFAULT_PIPELINE_VALUE,
  resolveDashboardPipelineValue,
} from "./dashboard-pipeline-options";

describe("dashboard pipeline options", () => {
  it("returns no options when there are no pipelines", () => {
    expect(buildDashboardPipelineOptions([])).toEqual([]);
  });

  it("shows the real default pipeline only once", () => {
    const options = buildDashboardPipelineOptions([
      { id: "default-id", name: "Novos Negócios", isDefault: true },
    ]);

    expect(options).toEqual([
      {
        value: DEFAULT_PIPELINE_VALUE,
        label: "Novos Negócios (Padrão)",
        pipelineId: "default-id",
      },
    ]);
  });

  it("keeps other pipelines selectable after the default", () => {
    const options = buildDashboardPipelineOptions([
      { id: "other-id", name: "Renovações", isDefault: false },
      { id: "default-id", name: "Novos Negócios", isDefault: true },
    ]);

    expect(options.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: DEFAULT_PIPELINE_VALUE, label: "Novos Negócios (Padrão)" },
      { value: "other-id", label: "Renovações" },
    ]);
  });

  it("uses the first pipeline as a safe fallback when none is marked default", () => {
    const options = buildDashboardPipelineOptions([
      { id: "first-id", name: "Primeiro", isDefault: false },
      { id: "second-id", name: "Segundo", isDefault: false },
    ]);

    expect(options[0]).toMatchObject({ value: DEFAULT_PIPELINE_VALUE, label: "Primeiro" });
  });

  it("resolves null and the real default id to the canonical default value", () => {
    const options = buildDashboardPipelineOptions([
      { id: "default-id", name: "Funil de Leads", isDefault: true },
      { id: "other-id", name: "Eventos", isDefault: false },
    ]);

    expect(resolveDashboardPipelineValue(null, options)).toBe(DEFAULT_PIPELINE_VALUE);
    expect(resolveDashboardPipelineValue("default-id", options)).toBe(DEFAULT_PIPELINE_VALUE);
    expect(resolveDashboardPipelineValue("other-id", options)).toBe("other-id");
  });
});
