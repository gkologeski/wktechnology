import { describe, expect, it } from "vitest";
import { meetingTitle, pickDefaultAgent, sortDefaultFirst } from "./default-agent";

const agents = [
  { id: "a", name: "Piloto" },
  { id: "b", name: "Lia" },
];

describe("agente principal", () => {
  it("prefere o principal", () => expect(pickDefaultAgent(agents, "b")).toBe("b"));
  it("ignora principal inexistente", () => expect(pickDefaultAgent(agents, "x")).toBe("a"));
  it("coloca o principal no topo", () =>
    expect(sortDefaultFirst(agents, "b").map((a) => a.id)).toEqual(["b", "a"]));
});

describe("título da reunião", () => {
  it("usa a empresa", () =>
    expect(meetingTitle(undefined, { company: "Acme" })).toBe("Reunião Acme <> WK Technology"));
  it("converte título antigo padrão", () =>
    expect(meetingTitle("Reunião com a WK Technology", { company: "Acme" })).toBe(
      "Reunião Acme <> WK Technology",
    ));
  it("sem empresa usa a pessoa", () =>
    expect(meetingTitle(undefined, { person: "Ana" })).toBe("Reunião Ana <> WK Technology"));
  it("sem ninguém volta ao título genérico", () =>
    expect(meetingTitle(undefined, {})).toBe("Reunião com a WK Technology"));
});
