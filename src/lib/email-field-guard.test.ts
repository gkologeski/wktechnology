/** Guardas AST: e-mail nativo rejeita EAI válido; z.string().email() diverge
 * do domínio IDNA/SMTPUTF8 compartilhado. Filtros parciais não são mailboxes. */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test.")
        ? [join(dir, entry.name)]
        : [],
  );
}
it("entradas de e-mail e schemas usam a regra compartilhada", () => {
  const issues: string[] = [];
  for (const file of files(join(ROOT, "src"))) {
    const name = relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function issue(node: ts.Node, message: string) {
      issues.push(
        `${name}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${message}`,
      );
    }
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "email"
      )
        issue(node, "Use emailSchema, não z.string().email().");
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(source) === "input"
      ) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(source) !== "type" || !attr.initializer)
            continue;
          const type = attr.initializer.getText(source);
          if (/\bemail\b/.test(type)) issue(node, "Use Input/EmailInput compartilhado.");
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(issues).toEqual([]);
}, 20000);
