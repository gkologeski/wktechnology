// Verifica que os campos convertidos para RichHtmlEditor (recurring, user-groups,
// dashboards, reports, roles) preservam a formatação HTML no ciclo
// salvar → recarregar → re-salvar, e descartam conteúdo visualmente vazio.
import { describe, expect, it } from "vitest";
import { sanitizeHtml, htmlToPlain } from "../components/rich-html-editor";
import { normalizeHtmlField, htmlEquivalent } from "./html-field";

const FORMATTED_SAMPLES: Array<{ name: string; html: string; plain: string }> = [
  { name: "negrito", html: "<p><strong>Importante</strong> texto</p>", plain: "Importante texto" },
  { name: "italico", html: "<p><em>frase</em></p>", plain: "frase" },
  { name: "sublinhado", html: "<p><u>destacado</u></p>", plain: "destacado" },
  {
    name: "lista nao ordenada",
    html: "<ul><li>um</li><li>dois</li></ul>",
    plain: "um dois",
  },
  {
    name: "lista ordenada",
    html: "<ol><li>primeiro</li><li>segundo</li></ol>",
    plain: "primeiro segundo",
  },
  {
    name: "link",
    html: '<p>Veja <a href="https://exemplo.com" target="_blank" rel="noopener">aqui</a></p>',
    plain: "Veja aqui",
  },
  {
    name: "mencao",
    html: '<p>Olá <span class="mention" data-user-id="u-1" data-mention="true">@João</span>!</p>',
    plain: "Olá @João !",
  },
  {
    name: "combinado",
    html: "<p><strong>Título</strong></p><ul><li><em>item</em></li></ul>",
    plain: "Título item",
  },
];

const EMPTY_SAMPLES = [
  "",
  "   ",
  "<p></p>",
  "<p><br></p>",
  "<p>   </p>",
  "<ul></ul>",
  "<div><br></div>",
];

describe("normalizeHtmlField (campos WYSIWYG salvos no banco)", () => {
  it.each(EMPTY_SAMPLES)("retorna null para conteúdo vazio: %s", (input) => {
    expect(normalizeHtmlField(input)).toBeNull();
  });

  it("retorna null para null/undefined", () => {
    expect(normalizeHtmlField(null)).toBeNull();
    expect(normalizeHtmlField(undefined)).toBeNull();
  });

  it.each(FORMATTED_SAMPLES)("preserva formatação em '$name'", ({ html }) => {
    const saved = normalizeHtmlField(html);
    expect(saved).not.toBeNull();
    // round-trip: salvar -> recarregar -> salvar de novo deve ser idempotente
    const reSaved = normalizeHtmlField(saved);
    expect(reSaved).toBe(saved);
    expect(htmlEquivalent(saved, html)).toBe(true);
  });
});

describe("sanitizeHtml mantém tags do toolbar", () => {
  it("não remove strong/em/u/ul/ol/li/a/p/span.mention", () => {
    const html =
      "<p><strong>b</strong><em>i</em><u>u</u></p>" +
      "<ul><li>x</li></ul><ol><li>y</li></ol>" +
      '<p><a href="https://x.com">l</a></p>' +
      '<p><span class="mention" data-user-id="1">@n</span></p>';
    const out = sanitizeHtml(html);
    for (const tag of [
      "<strong>",
      "<em>",
      "<u>",
      "<ul>",
      "<ol>",
      "<li>",
      "<a ",
      '<span class="mention"',
    ]) {
      expect(out).toContain(tag);
    }
  });

  it("remove scripts e handlers inline (XSS)", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script><p onclick="x">y</p>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>ok</p>");
  });
});

describe("htmlToPlain (usado em contadores e fallbacks de texto)", () => {
  it.each(FORMATTED_SAMPLES)("extrai texto puro de '$name'", ({ html, plain }) => {
    expect(htmlToPlain(html)).toBe(plain);
  });

  it("retorna string vazia para entradas vazias", () => {
    for (const v of EMPTY_SAMPLES) expect(htmlToPlain(v)).toBe("");
    expect(htmlToPlain(null as unknown as string)).toBe("");
    expect(htmlToPlain(undefined as unknown as string)).toBe("");
  });
});

describe("ciclo salvar→recarregar→exibir (HtmlContent renderiza sanitizado)", () => {
  // HtmlContent injeta sanitizeHtml(value) via dangerouslySetInnerHTML.
  // Aqui validamos que o conteúdo exibido bate com o salvo.
  it.each(FORMATTED_SAMPLES)("round-trip de '$name' preserva a marcação", ({ html }) => {
    const persisted = normalizeHtmlField(html)!;
    const displayed = sanitizeHtml(persisted); // o que <HtmlContent /> renderiza
    expect(displayed).toBe(persisted);
  });
});
