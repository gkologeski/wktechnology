import { describe, expect, it } from "vitest";
import { classifyChanges } from "../../../scripts/verify-changed/select";

const all = () => true;

describe("verify-changed: seleção conservadora", () => {
  it("sem lista de alterações → completo", () => {
    expect(classifyChanges(null, all).mode).toBe("full");
  });
  it.each([
    "package.json",
    "bun.lock",
    "vite.config.ts",
    "tsconfig.json",
    "src/routeTree.gen.ts",
    "src/integrations/supabase/types.ts",
    "src/components/ui/button.tsx",
    "src/lib/utils.ts",
    "supabase/migrations/0100_x.sql",
  ])("%s → completo", (f) => {
    expect(classifyChanges([f, "src/lib/inbox/message-history.ts"], all).mode).toBe("full");
  });
  it("arquivo fora do mapa → completo", () => {
    expect(classifyChanges(["foo/bar.yaml"], all).mode).toBe("full");
  });
  it("arquivo de código removido → completo", () => {
    expect(classifyChanges(["src/lib/x.ts"], () => false).mode).toBe("full");
  });
  it("código de módulo → incremental com lint e testes relacionados", () => {
    const p = classifyChanges(
      ["src/lib/inbox/message-history.ts", "src/routes/_authenticated/(ats)/jobs.index.tsx"],
      all,
    );
    expect(p.mode).toBe("incremental");
    expect(p.lintFiles).toHaveLength(2);
    expect(p.testTargets).toHaveLength(2);
    expect(p.modules).toEqual(expect.arrayContaining(["TechSales", "TechHire"]));
  });
  it("só documentação → nada além do typecheck", () => {
    expect(classifyChanges(["docs/architecture/x.md"], all).mode).toBe("none");
  });
});
