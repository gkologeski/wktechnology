// Regras puras da Fase 3 da Ajuda: acesso a trilhas/quizzes (mesma regra de
// leitura do módulo da Ajuda) e cálculo da nota.
import { canReadHelpModule, type HelpAccessInput } from "./help-access";
import { QUIZ_PASS_SCORE } from "./training-catalogue";

export function canUseTraining(module: string, input: HelpAccessInput): boolean {
  if (input.membershipStatus !== "active" && !input.isPlatformAdmin) return false;
  return canReadHelpModule(module, input);
}

export function assertTrainingAccess(module: string, input: HelpAccessInput): void {
  if (!canUseTraining(module, input)) throw new Error("Trilha indisponível para o seu acesso.");
}

export function scoreQuiz(answers: number[], key: number[]) {
  if (answers.length !== key.length) throw new Error("Responda todas as perguntas.");
  const score = key.reduce((acc, k, i) => acc + (answers[i] === k ? 1 : 0), 0);
  return { score, total: key.length, passed: score >= Math.min(QUIZ_PASS_SCORE, key.length) };
}
