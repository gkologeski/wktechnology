// Fachada do motor de workflows: mantém a API pública estável enquanto a
// implementação vive em módulos menores.
//   - engine-shared.server.ts   tipos, helpers e avaliação de condições
//   - engine-actions.server.ts  execução das ações
//   - engine-runtime.server.ts  eventos, runs e ticks
export { runActions } from "./engine-actions.server";
export { processEvent, tickWorkflows, tickTimeTriggers } from "./engine-runtime.server";
