import { describe, it, expect } from "vitest";
import { buildLeadSubstatusPatch } from "./stages";

describe("buildLeadSubstatusPatch", () => {
  it("lead sem funil recebe funil e etapa ao definir substatus", () => {
    expect(buildLeadSubstatusPatch({}, "ss1", "pipe", "contacting")).toEqual({
      stage_substatus_id: "ss1",
      pipeline_id: "pipe",
      stage_id: "contacting",
    });
  });
  it("não sobrescreve funil/etapa existentes", () => {
    expect(
      buildLeadSubstatusPatch({ pipeline_id: "p0", stage_id: "new" }, "ss1", "pipe", "contacting"),
    ).toEqual({ stage_substatus_id: "ss1" });
  });
  it("limpar substatus não mexe em funil/etapa", () => {
    expect(buildLeadSubstatusPatch({}, null, "pipe", "new")).toEqual({ stage_substatus_id: null });
  });
});
