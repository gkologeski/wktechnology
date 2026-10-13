import { describe, expect, it } from "vitest";
import { acceptAnswers, type CanonicalQuestion } from "./qualification";
import type { ConversationMessage } from "./policy";

const q = (id: string, label: string): CanonicalQuestion =>
  ({ id, label, type: "text", weight: 1, options: [] }) as unknown as CanonicalQuestion;
const inbound = [
  { id: "m1", direction: "inbound", body: "Queremos começar em dezembro de 2026" },
] as unknown as ConversationMessage[];
const ans = (question_id: string) => [
  { question_id, value: "Começar em dezembro de 2026", message_id: "m1", excerpt: "dezembro de 2026" },
];

describe("acceptAnswers por rótulo", () => {
  it("aceita o rótulo da pergunta ignorando acento e caixa", () => {
    const r = acceptAnswers([q("q-1", "Timeline")], ans("timeline"), inbound);
    expect(r.accepted.map((a) => a.question_id)).toEqual(["q-1"]);
  });
  it("recusa rótulo ambíguo", () => {
    const r = acceptAnswers([q("a", "Prazo"), q("b", "Prazo")], ans("Prazo"), inbound);
    expect(r.accepted).toHaveLength(0);
  });
  it("continua aceitando o id", () => {
    expect(acceptAnswers([q("q-1", "Timeline")], ans("q-1"), inbound).accepted).toHaveLength(1);
  });
});
