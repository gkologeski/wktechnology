import { describe, expect, it } from "vitest";
import { pickHighestRole } from "./use-my-role";

describe("pickHighestRole", () => {
  it("dono de workspace é admin", () => expect(pickHighestRole(true, [])).toBe("admin"));
  it("sem papel vira membro", () => expect(pickHighestRole(false, [])).toBe("member"));
  it("escolhe o maior papel", () =>
    expect(pickHighestRole(false, ["member", "manager"])).toBe("manager"));
  it("ignora papel desconhecido", () => expect(pickHighestRole(false, ["x"])).toBe("member"));
});
