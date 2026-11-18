import { describe, expect, it } from "vitest";
import { addSenderPick, groupTemplatesBySender, parsePick, pickValue } from "./campaign-template-groups";

const t = (name: string) => ({ name, language: "pt_BR", approved: true });

describe("modelos por número", () => {
  it("mantém o mesmo nome separado em cada número", () => {
    const g = groupTemplatesBySender([
      { senderId: "A", items: [t("prospeccao_001")] },
      { senderId: "B", items: [t("prospeccao_001")] },
    ]);
    expect(g.map((x) => [x.senderId, x.items.map((i) => i.name)])).toEqual([
      ["A", ["prospeccao_001"]],
      ["B", ["prospeccao_001"]],
    ]);
  });
  it("escolher o mesmo modelo em outro número soma o número", () => {
    let s = addSenderPick({}, "p", "A");
    s = addSenderPick(s, "p", "B");
    s = addSenderPick(s, "p", "A");
    expect(s.p).toEqual(["A", "B"]);
  });
  it("valor da opção ida e volta", () => {
    expect(parsePick(pickValue("123", "a::b"))).toEqual({ senderId: "123", name: "a::b" });
    expect(parsePick("__none__")).toBeNull();
  });
});
