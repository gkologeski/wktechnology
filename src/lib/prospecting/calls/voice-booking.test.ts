import { describe, expect, it } from "vitest";
import {
  chooseHost,
  countBodyParams,
  matchOffer,
  meetingTemplateVariables,
  parseVoiceToolCalls,
} from "./voice-booking";

const hosts = new Set(["a", "c"]);

describe("agendamento na ligação", () => {
  it("rodízio pula quem não tem agenda e avança o cursor", () => {
    expect(
      chooseHost({
        mode: "round_robin",
        memberIds: ["a", "b", "c"],
        cursor: 1,
        recordOwnerId: null,
        hosts,
      }),
    ).toEqual({ hostId: "c", nextCursor: 3 });
  });
  it("responsável sem agenda não recebe reunião", () => {
    expect(
      chooseHost({ mode: "auto", memberIds: [], cursor: 0, recordOwnerId: "b", hosts }).hostId,
    ).toBeNull();
  });
  it("sem agendamento nunca escolhe anfitrião", () => {
    expect(
      chooseHost({ mode: "unassigned", memberIds: ["a"], cursor: 0, recordOwnerId: "a", hosts })
        .hostId,
    ).toBeNull();
  });
  it("só marca opção oferecida", () => {
    const offers = [{ option: 1, start: 1, end: 2 }];
    expect(matchOffer(offers, 1)).toEqual(offers[0]);
    expect(matchOffer(offers, "1")).toEqual(offers[0]);
    expect(matchOffer(offers, 2)).toBeNull();
  });
  it("lê chamadas de função da Vapi com argumentos em texto", () => {
    expect(
      parseVoiceToolCalls({
        toolCallList: [
          { id: "t1", function: { name: "marcar_reuniao", arguments: '{"opcao":2}' } },
        ],
      }),
    ).toEqual([{ id: "t1", name: "marcar_reuniao", args: { opcao: 2 } }]);
  });
  it("variáveis do modelo seguem a quantidade do corpo", () => {
    const n = countBodyParams([{ type: "BODY", text: "Oi {{1}}, reunião {{2}}" }]);
    expect(meetingTemplateVariables(n, { firstName: "Ana", when: "seg 10h", link: "L" })).toEqual([
      "Ana",
      "seg 10h",
    ]);
  });
});
