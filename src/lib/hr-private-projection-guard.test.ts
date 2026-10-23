/** Private columns must not reappear in client SELECTs after column ACL rollout. */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
const root = join(__dirname, "..", "..");
const protectedColumns: Record<string, string[]> = {
  people: [
    "cost_hour",
    "monthly_cost",
    "personal_doc",
    "bank",
    "bank_agency",
    "bank_account",
    "pix_key",
    "address",
  ],
  people_one_on_ones: ["private_notes"],
  people_allocations: ["billable_rate", "cost_rate"],
};
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
        ? [join(dir, e.name)]
        : [],
  );
}
it("private tables use explicit public projections and the authorized RPC", () => {
  const failures: string[] = [];
  for (const file of files(join(root, "src"))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function scope(node: ts.Node): ts.Node {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current))
        current = current.parent;
      return current ?? source;
    }
    function table(expression: ts.Expression, seen = new Set<string>()): string | null {
      if (
        ts.isAsExpression(expression) ||
        ts.isParenthesizedExpression(expression) ||
        ts.isNonNullExpression(expression) ||
        ts.isSatisfiesExpression(expression)
      )
        return table(expression.expression, seen);
      if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
        if (
          expression.expression.name.text === "from" &&
          expression.arguments[0] &&
          ts.isStringLiteralLike(expression.arguments[0])
        )
          return expression.arguments[0].text;
        return table(expression.expression.expression, seen);
      }
      if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
        const name = expression.text;
        seen.add(name);
        let result: string | null = null;
        const enclosing = scope(expression);
        function find(node: ts.Node) {
          if (node !== enclosing && ts.isFunctionLike(node)) return;
          if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer
          )
            result = table(node.initializer, new Set(seen));
          ts.forEachChild(node, find);
        }
        find(enclosing);
        return result;
      }
      return null;
    }
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "select"
      ) {
        const target = table(node.expression.expression);
        const arg = node.arguments[0];
        if (target === "people_total_cost")
          failures.push(relative(root, file) + ": deprecated salary view");
        if (target && protectedColumns[target] && arg && ts.isStringLiteralLike(arg)) {
          const fields = arg.text.split(/[,()]/).map((v) => v.trim());
          if (fields.includes("*") || protectedColumns[target].some((key) => fields.includes(key)))
            failures.push(
              `${relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${target}: ${arg.text}`,
            );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(failures).toEqual([]);
}, 20000);
