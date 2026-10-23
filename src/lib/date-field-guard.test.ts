/**
 * Guarda de regressão dos campos de data (docs/architecture/date-fields.md).
 *
 * Data única só por `DatePicker` / `IsoDatePicker` (skill date-picker-br);
 * data-hora só por `ActivityDateTimePicker` (mesma seleção de dia).
 *
 * Analisa a árvore do TypeScript (não linhas), então pega atributos em
 * várias linhas e tipos indiretos:
 * - `type="date"` / `type={"date"}` em qualquer elemento JSX;
 * - em `<input>`/`<Input>`, o `type` dinâmico é resolvido (ternários,
 *   `??`/`||`, constantes do arquivo). Se puder valer "date"/"datetime-local"
 *   OU vier de um metadado não comprovado (ex.: `f.type ?? "text"`), é
 *   violação. Prova aceita de não-data: literais, `nativeInputType(...)`
 *   (que exige no tipo que a data já foi tratada) ou repasse de prop de um
 *   componente-invólucro (cujos usos são checados do mesmo jeito);
 * - o texto "datetime-local" em qualquer código;
 * - calendário avulso (`@/components/ui/calendar`) fora dos compartilhados.
 * Intervalos (DateRangePicker), mês/horário isolados e declarações de
 * esquema (`{ type: "date" }`) não são entradas e ficam fora.
 * Exceção nova exige motivo aqui e no documento.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** Componentes que podem usar o calendário base diretamente. */
const CALENDAR_OWNERS = new Set([
  "src/components/date-picker.tsx",
  "src/components/date-range-picker.tsx",
  "src/components/date-range-filter.tsx",
  "src/components/ui/calendar.tsx",
]);

/** Exceções justificadas (arquivo → motivo). */
const ALLOWED: Record<string, string> = {
  // Expressão regular que lê HTML de documento importado (não é tela).
  "src/lib/import/document-source.ts": "leitura de HTML de integração",
  // O próprio auxiliar que EXCLUI os tipos de data (só aparece no tipo).
  "src/lib/native-input-type.ts": "lista de tipos de data excluídos pelo auxiliar",
};

const INPUT_TAGS = new Set(["input", "Input"]);
/** Funções cujo retorno é comprovadamente um tipo de texto (nunca data). */
const SAFE_TYPE_FNS = new Set(["nativeInputType"]);

type Resolved = { values: Set<string>; unknown: string[] };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p, out);
    } else if (
      /\.(tsx|ts)$/.test(name) &&
      !/\.test\.tsx?$/.test(name) &&
      !name.endsWith(".gen.ts")
    ) {
      out.push(p);
    }
  }
  return out;
}

/** Declarações por nome no arquivo (escopo conservador: todas contam). */
function collectDeclarations(sf: ts.SourceFile) {
  const vars = new Map<string, ts.Expression[]>();
  const params = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const list = vars.get(n.name.text) ?? [];
      list.push(n.initializer);
      vars.set(n.name.text, list);
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) {
      params.add(n.name.text);
    } else if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) {
      // Desestruturação de props: `function X({ type = "text" })`.
      let p: ts.Node | undefined = n.parent;
      while (p && !ts.isParameter(p) && !ts.isVariableDeclaration(p)) p = p.parent;
      if (p && ts.isParameter(p)) params.add(n.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { vars, params };
}

function resolveType(
  expr: ts.Expression,
  decls: ReturnType<typeof collectDeclarations>,
  sf: ts.SourceFile,
  depth = 0,
): Resolved {
  const out: Resolved = { values: new Set(), unknown: [] };
  const merge = (r: Resolved) => {
    r.values.forEach((v) => out.values.add(v));
    out.unknown.push(...r.unknown);
  };
  const e = expr;
  if (depth > 8) {
    out.unknown.push(e.getText(sf));
    return out;
  }
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    out.values.add(e.text);
  } else if (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e)
  ) {
    merge(resolveType(e.expression, decls, sf, depth + 1));
  } else if (ts.isConditionalExpression(e)) {
    merge(resolveType(e.whenTrue, decls, sf, depth + 1));
    merge(resolveType(e.whenFalse, decls, sf, depth + 1));
  } else if (
    ts.isBinaryExpression(e) &&
    (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    merge(resolveType(e.left, decls, sf, depth + 1));
    merge(resolveType(e.right, decls, sf, depth + 1));
  } else if (
    ts.isCallExpression(e) &&
    ts.isIdentifier(e.expression) &&
    SAFE_TYPE_FNS.has(e.expression.text)
  ) {
    out.values.add("text");
  } else if (ts.isIdentifier(e)) {
    if (e.text === "undefined") return out;
    const inits = decls.vars.get(e.text);
    if (inits?.length) inits.forEach((i) => merge(resolveType(i, decls, sf, depth + 1)));
    else if (!decls.params.has(e.text)) out.unknown.push(e.text);
    // Parâmetro/prop: repasse de invólucro — os usos dele são checados.
  } else {
    out.unknown.push(e.getText(sf));
  }
  return out;
}

function tagName(n: ts.JsxOpeningLikeElement): string {
  return n.tagName.getText();
}

export function findDateFieldViolations(rel: string, src: string): string[] {
  if (ALLOWED[rel]) return [];
  const sf = ts.createSourceFile(
    rel,
    src,
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX,
  );
  const decls = collectDeclarations(sf);
  const out: string[] = [];
  const at = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

  const visit = (n: ts.Node) => {
    if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      n.text === "datetime-local"
    ) {
      out.push(`${at(n)}: "datetime-local" — use ActivityDateTimePicker`);
    }
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === "type" && n.initializer) {
      const el = n.parent.parent as ts.JsxOpeningLikeElement;
      const tag = tagName(el);
      const init = n.initializer;
      const expr = ts.isJsxExpression(init)
        ? init.expression
        : ts.isStringLiteral(init)
          ? init
          : undefined;
      if (expr) {
        const r = resolveType(expr, decls, sf);
        const literal = ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
        // Em <input>/<Input> qualquer caminho até "date" conta; em outros
        // elementos só o literal direto (componentes podem rotear a data).
        if (r.values.has("date") && (INPUT_TAGS.has(tag) || literal)) {
          out.push(`${at(n)}: <${tag} type> pode ser "date" — use IsoDatePicker`);
        }
        if (INPUT_TAGS.has(tag) && r.unknown.length) {
          out.push(
            `${at(n)}: <${tag} type={${r.unknown.join(", ")}}> sem prova de não-data — trate a data com IsoDatePicker e use nativeInputType()`,
          );
        }
      }
    }
    if (
      ts.isImportDeclaration(n) &&
      ts.isStringLiteral(n.moduleSpecifier) &&
      n.moduleSpecifier.text === "@/components/ui/calendar" &&
      !CALENDAR_OWNERS.has(rel)
    ) {
      out.push(`${rel}: calendário avulso — use DatePicker/DatePickerPanel`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return [...new Set(out)];
}

describe("guarda dos campos de data", () => {
  it("nenhuma tela usa entrada de data nativa nem calendário avulso", () => {
    const files = walk(SRC).map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, "utf8") }));
    expect(files.length).toBeGreaterThan(500);
    const violations = files.flatMap((f) => findDateFieldViolations(f.rel, f.src));
    expect(violations).toEqual([]);
  }, 20_000);

  it("detecta as formas proibidas, inclusive em várias linhas", () => {
    const v = (s: string) => findDateFieldViolations("x.tsx", s);
    expect(v('<Input type="date" value={v} />')).toHaveLength(1);
    expect(v("<input type='date' />")).toHaveLength(1);
    expect(v('<Field type={"date"} />')).toHaveLength(1);
    expect(v('<Input type={f.type === "date" ? "date" : "text"} />')).toHaveLength(1);
    // filter-builder-dialog / audience-groups-editor (antes da correção).
    expect(
      v(`<Input
          className="flex-1"
          type={
            field?.type === "date"
              ? "date"
              : field?.type === "number"
                ? "number"
                : "text"
          }
        />`),
    ).toHaveLength(1);
    // Constante intermediária (grid-filter-panel antes da simplificação).
    expect(v('const type = k === "date" ? "date" : "number";\n<Input type={type} />')).toHaveLength(
      1,
    );
    expect(v('const t = "datetime-local";')).toHaveLength(1);
    expect(v('import { Calendar } from "@/components/ui/calendar";')).toHaveLength(1);
  });

  it("barra tipo vindo de metadado sem prova (bulk-edit/entity-list/properties-panel antes)", () => {
    const v = (s: string) => findDateFieldViolations("x.tsx", s);
    expect(v('<Input type={f.type ?? "text"} />')).toHaveLength(1);
    expect(v('<Input type={fieldDef?.type ?? "text"} />')).toHaveLength(1);
    expect(v('<Input type={p.type === "cep" ? "text" : (p.type ?? "text")} />')).toHaveLength(1);
    expect(v("<input type={def.kind} />")).toHaveLength(1);
  });

  it("aceita literais, nativeInputType, constantes não-data e repasse de invólucro", () => {
    const v = (s: string) => findDateFieldViolations("x.tsx", s);
    expect(v('<Input type={f.type === "number" ? "number" : "text"} />')).toEqual([]);
    expect(v("<Input type={nativeInputType(f.type)} />")).toEqual([]);
    expect(v('const inputType = a ? "email" : "text";\n<Input type={inputType} />')).toEqual([]);
    expect(
      v('function W({ type = "text" }: { type?: string }) { return <input type={type} />; }'),
    ).toEqual([]);
    expect(
      v("function W(props: P) { const { type } = props; return <input type={type} />; }"),
    ).toHaveLength(1);
    expect(v('<Button type="submit" />')).toEqual([]);
    expect(v("<source type={contentType} />")).toEqual([]);
  });

  it("não barra intervalos, mês/horário isolados, esquemas nem comentários", () => {
    const v = (s: string) => findDateFieldViolations("x.tsx", s);
    expect(v("<DateRangePicker value={r} />")).toEqual([]);
    expect(v('<Input type="month" />')).toEqual([]);
    expect(v('<Input type="time" />')).toEqual([]);
    expect(v('const f = [{ name: "due", type: "date" }];')).toEqual([]);
    expect(v('if (field.type === "date") return null;')).toEqual([]);
    expect(v('// antes: <input type="date">\n/* "datetime-local" */')).toEqual([]);
    expect(
      findDateFieldViolations(
        "src/components/date-picker.tsx",
        'import { Calendar } from "@/components/ui/calendar";',
      ),
    ).toEqual([]);
  });

  it("toda exceção tem motivo", () => {
    for (const [file, why] of Object.entries(ALLOWED)) {
      expect(why.length, file).toBeGreaterThan(5);
    }
  });
});
