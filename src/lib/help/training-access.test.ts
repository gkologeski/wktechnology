import { describe, expect, it } from "vitest";
import type { HelpAccessInput } from "./help-access";
import { assertTrainingAccess, canUseTraining, scoreQuiz } from "./training-access";
import { QUIZZES } from "./training-quiz.server";
import { TRAINING_TRACKS } from "./training-catalogue";
import catalogue from "./official-catalogue.json";

const ws = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
const key = "techfinance.entries.view.workspace";
const base: HelpAccessInput = {
  activeWorkspaceId: ws,
  membershipStatus: "active",
  isPlatformAdmin: false,
  isWorkspaceAdmin: false,
  licensedModules: ["finance"],
  grants: [{ workspaceId: ws, key, effect: "allow" }],
};

describe("Trilhas — autorização", () => {
  it("permite trilha a membro ativo autorizado", () => {
    expect(canUseTraining("finance", base)).toBe(true);
  });
  it("nega trilha sem chave", () => {
    expect(canUseTraining("finance", { ...base, grants: [] })).toBe(false);
  });
  it("nega trilha com deny explícito", () => {
    expect(
      canUseTraining("finance", {
        ...base,
        grants: [...base.grants, { workspaceId: ws, key, effect: "deny" }],
      }),
    ).toBe(false);
  });
  it("nega trilha com chave de outro workspace", () => {
    expect(
      canUseTraining("finance", { ...base, grants: [{ workspaceId: other, key, effect: "allow" }] }),
    ).toBe(false);
  });
  it("nega trilha a membro inativo", () => {
    expect(() => assertTrainingAccess("finance", { ...base, membershipStatus: "inactive" })).toThrow();
  });
});

describe("Trilhas — quiz", () => {
  it("aprova com 4 de 5 e reprova com 3", () => {
    expect(scoreQuiz([1, 1, 1, 1, 0], [1, 1, 1, 1, 1])).toEqual({ score: 4, total: 5, passed: true });
    expect(scoreQuiz([1, 1, 1, 0, 0], [1, 1, 1, 1, 1]).passed).toBe(false);
  });
  it("exige todas as respostas", () => {
    expect(() => scoreQuiz([1, 1], [1, 1, 1, 1, 1])).toThrow();
  });
  it("cada trilha tem quiz de 5 perguntas e artigos oficiais existentes", () => {
    for (const t of TRAINING_TRACKS) {
      const quiz = QUIZZES[t.module] ?? [];
      expect(quiz).toHaveLength(5);
      for (const q of quiz) expect(q.answer).toBeLessThan(q.options.length);
      const official = (catalogue as Array<{ module_key: string; slug: string }>).filter(
        (a) => a.module_key === t.module,
      );
      const found = t.slugs.filter((s) => official.some((a) => a.slug === s));
      expect(found.length).toBeGreaterThanOrEqual(5);
    }
  });
});
