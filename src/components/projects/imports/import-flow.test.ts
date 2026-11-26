import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  JourneyRun,
  JourneySource,
  JourneyStatus,
} from "@/lib/projects/imports/import-journey";
import { ImportFlow } from "./import-flow";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));

const source = (p: Partial<JourneySource> = {}): JourneySource => ({
  provider: "clockify",
  label: "Clockify",
  canView: true,
  canManage: true,
  configured: true,
  ready: true,
  sourceId: "source",
  sourceName: "Organização autorizada",
  connectionStatus: "connected",
  error: null,
  coverage: [
    { entity: "time_entry", label: "Lançamentos de horas", status: "available", count: null },
  ],
  ...p,
});
const run = (p: Partial<JourneyRun> = {}): JourneyRun => ({
  id: "run",
  provider: "clockify",
  sourceName: "Organização autorizada",
  status: "running",
  phase: "Recebendo lançamentos",
  received: 12,
  ready: 5,
  pending: 2,
  coverageComplete: false,
  createdAt: "2026-11-26T12:00:00Z",
  resumable: true,
  ...p,
});
const status = (p: Partial<JourneyStatus> = {}): JourneyStatus => ({
  workspaceId: "workspace",
  legacyPending: false,
  sources: [source()],
  runs: [],
  summary: { received: 12, ready: 5, pending: 2, unclassified: 5 },
  ...p,
});
const render = (p: Partial<Parameters<typeof ImportFlow>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ImportFlow, {
      status: status(),
      step: 1,
      selected: ["clockify"],
      busy: false,
      readOnly: false,
      onSelection: vi.fn(),
      onStep: vi.fn(),
      onStart: vi.fn(),
      onResume: vi.fn(),
      onReview: vi.fn(),
      onRecords: vi.fn(),
      onConnection: vi.fn(),
      ...p,
    }),
  );

describe("Jornada única de importação", () => {
  it("orienta a receber o histórico sem decisões de descarte ou data", () => {
    const html = render();
    expect(html).toContain("Conferir cobertura");
    expect(html).toContain("lançamentos com erro");
    expect(html).toContain("Sem escolher períodos ou descartar registros inválidos");
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("Deixar fora");
  });
  it("não permite prosseguir com origem sem configuração ou sem gestão", () => {
    const html = render({
      status: status({ sources: [source({ ready: false, canManage: false })] }),
    });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Conferir cobertura/);
    expect(html).not.toContain("Configurar conexão");
  });
  it("apresenta cobertura desconhecida como a verificar sem inventar zero", () => {
    const html = render({
      step: 2,
      status: status({
        sources: [
          source({
            coverage: [
              {
                entity: "attachment",
                label: "Arquivos",
                status: "unknown",
                count: null,
                reason: "A origem ainda não foi consultada.",
              },
            ],
          }),
        ],
      }),
    });
    expect(html).toContain("A verificar");
    expect(html).toContain("A origem ainda não foi consultada");
    expect(html).not.toContain("0 já recebidos");
    expect(html).toContain("um tipo sem acesso não equivale a zero registros");
  });
  it("mantém coleta incompleta e contagens recebidas visíveis com retomada", () => {
    const interrupted = run({ status: "partial", error: "Conexão interrompida" });
    const html = render({
      step: 3,
      status: status({ sources: [source({ latestRun: interrupted })], runs: [interrupted] }),
    });
    expect(html).toContain("12 recebidos");
    expect(html).toContain("Coleta incompleta");
    expect(html).toContain("Retomar importação");
    expect(html).toContain("Ver registros recebidos");
    expect(html).not.toContain("Cobertura completa");
  });
  it("somente leitura não permite iniciar nem retomar uma escrita", () => {
    const initial = render({ readOnly: true });
    expect(initial).toContain("O modo somente leitura");
    expect(initial).toMatch(/<button[^>]*disabled=""[^>]*>Conferir cobertura/);
    const partial = run({ status: "paused" });
    const html = render({
      readOnly: true,
      step: 3,
      status: status({ sources: [source({ latestRun: partial })] }),
    });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Retomar importação/);
  });
  it("desabilita a retomada até a origem voltar a estar pronta", () => {
    const interrupted = run({ status: "partial" });
    const state = (ready: boolean) => ({
      step: 3,
      status: status({ sources: [source({ ready, latestRun: interrupted })] }),
    });
    const button = (html: string) =>
      html.match(
        /<button[^>]*>(?:(?!<\/button>)[\s\S])*Retomar importação(?:(?!<\/button>)[\s\S])*<\/button>/,
      )?.[0];
    expect(button(render(state(false)))).toContain('disabled=""');
    expect(button(render(state(true)))).not.toContain('disabled=""');
  });
  it("resultado conserva pendências e classificação em aberto sem aprovar horas", () => {
    const completed = run({ status: "complete", coverageComplete: true, resumable: false });
    const html = render({
      step: 4,
      status: status({ sources: [source({ latestRun: completed })] }),
    });
    expect(html).toContain("5 registros recebidos ainda estão em classificação");
    expect(html).toContain("Registros já existentes não são somados novamente");
    expect(html).toContain("Importar não aprova horas");
    expect(html).toContain("Revisar pendências");
  });
  it("limitação terminal da origem não vira cobertura completa nem retomada sem solução", () => {
    const limited = run({
      status: "partial",
      sourceLimited: true,
      resumable: false,
      error: "A API não disponibiliza tarefas apagadas.",
    });
    const html = render({ step: 4, status: status({ sources: [source({ latestRun: limited })] }) });
    expect(html).toContain("Limitações da origem");
    expect(html).toContain("tarefas apagadas");
    expect(html).not.toContain("Cobertura completa");
    expect(html).not.toContain("Retomar importação");
  });
  it("não mostra uma origem sem permissão de consulta", () => {
    const html = render({
      status: status({
        sources: [
          source({
            provider: "jibble",
            label: "Jibble",
            canView: false,
            sourceName: "Organização oculta",
          }),
        ],
      }),
    });
    expect(html).not.toContain("Organização oculta");
    expect(html).not.toContain("Configurar conexão");
  });
});
