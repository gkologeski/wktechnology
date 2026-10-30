import { describe, expect, it } from "vitest";
import { pickMappedColumns } from "./csv-import-rows";

describe("pickMappedColumns", () => {
  it("descarta colunas não mapeadas, mesmo com 5.000 caracteres", () => {
    const { rows } = pickMappedColumns([{ Email: "a@b.com", Keywords: "x".repeat(5000) }], {
      Email: "email",
    });
    expect(rows[0]).toEqual({ Email: "a@b.com" });
  });
  it("corta campo mapeado em 2.000 e conta", () => {
    const { rows, truncated } = pickMappedColumns([{ K: "y".repeat(2500) }], { K: "notes" });
    expect(rows[0].K).toHaveLength(2000);
    expect(truncated).toEqual({ K: 1 });
  });
});
