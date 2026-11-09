// Converte o XML de um .docx em HTML preservando a formatação original:
// alinhamento, recuos, espaçamento, títulos, negrito/itálico/sublinhado,
// tamanho/cor de fonte, numeração das listas e tabelas com bordas.
// Puro (sem DOM) para rodar no navegador e nos testes.

export interface DocxParts {
  document: string;
  numbering?: string;
  styles?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\bw:${name}="([^"]*)"`).exec(tag);
  return m ? m[1]! : null;
}

function firstTag(xml: string, name: string): string | null {
  const m = new RegExp(`<w:${name}(?:\\s[^>]*)?/?>`).exec(xml);
  return m ? m[0] : null;
}

function onOff(xml: string, name: string): boolean {
  const t = firstTag(xml, name);
  if (!t) return false;
  const v = attr(t, "val");
  return v === null || !/^(0|false|none)$/i.test(v);
}

/** Extrai os filhos diretos `<w:p>`/`<w:tbl>` de um trecho, respeitando aninhamento. */
function blocks(xml: string): Array<{ kind: "p" | "tbl"; xml: string }> {
  const out: Array<{ kind: "p" | "tbl"; xml: string }> = [];
  const re = /<w:(p|tbl)(?=[\s>/])[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const kind = m[1] as "p" | "tbl";
    const start = m.index;
    if (m[2] === "/") {
      out.push({ kind, xml: m[0] });
      continue;
    }
    const tagRe = new RegExp(`<(/?)w:${kind}(?=[\\s>/])[^>]*?(/?)>`, "g");
    tagRe.lastIndex = re.lastIndex;
    let depth = 1;
    let t: RegExpExecArray | null;
    let end = xml.length;
    while ((t = tagRe.exec(xml))) {
      if (t[2] === "/") continue;
      depth += t[1] === "/" ? -1 : 1;
      if (depth === 0) {
        end = tagRe.lastIndex;
        break;
      }
    }
    out.push({ kind, xml: xml.slice(start, end) });
    re.lastIndex = end;
  }
  return out;
}

const twipToPt = (v: string | null) => (v && /^-?\d+$/.test(v) ? Number(v) / 20 : 0);

interface Level {
  start: number;
  fmt: string;
  text: string;
  indLeft: number;
  hanging: number;
}

function parseNumbering(xml?: string) {
  const abstract = new Map<string, Map<number, Level>>();
  const nums = new Map<string, string>();
  if (!xml) return { abstract, nums };
  for (const a of xml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const levels = new Map<number, Level>();
    for (const l of a[2]!.matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      const body = l[2]!;
      const ind = firstTag(body, "ind");
      levels.set(Number(l[1]), {
        start: Number(attr(firstTag(body, "start") ?? "", "val") ?? 1),
        fmt: attr(firstTag(body, "numFmt") ?? "", "val") ?? "decimal",
        text: decodeXml(attr(firstTag(body, "lvlText") ?? "", "val") ?? ""),
        indLeft: twipToPt(ind ? (attr(ind, "left") ?? attr(ind, "start")) : null),
        hanging: twipToPt(ind ? attr(ind, "hanging") : null),
      });
    }
    abstract.set(a[1]!, levels);
  }
  for (const n of xml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    const id = attr(firstTag(n[2]!, "abstractNumId") ?? "", "val");
    if (id) nums.set(n[1]!, id);
  }
  return { abstract, nums };
}

function roman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let r = "";
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}

function letter(n: number): string {
  let s = "";
  while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function fmtNum(n: number, fmt: string): string {
  switch (fmt) {
    case "lowerLetter": return letter(n);
    case "upperLetter": return letter(n).toUpperCase();
    case "lowerRoman": return roman(n);
    case "upperRoman": return roman(n).toUpperCase();
    case "bullet": return "";
    case "none": return "";
    default: return String(n);
  }
}

/** Estilos de parágrafo que viram títulos (Heading1, Título1, Title...). */
function headingStyles(stylesXml?: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!stylesXml) return map;
  for (const s of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = (attr(firstTag(s[2]!, "name") ?? "", "val") ?? "").toLowerCase();
    const m = /^(?:heading|título|titulo)\s*(\d)$/.exec(name);
    if (m) map.set(s[1]!, Math.min(4, Number(m[1])));
    else if (name === "title") map.set(s[1]!, 1);
  }
  return map;
}

function runStyle(rPr: string): { key: string; open: string; close: string } {
  const tags: string[] = [];
  if (onOff(rPr, "b")) tags.push("strong");
  if (onOff(rPr, "i")) tags.push("em");
  const u = firstTag(rPr, "u");
  if (u && !/^none$/i.test(attr(u, "val") ?? "")) tags.push("u");
  if (onOff(rPr, "strike")) tags.push("s");
  const css: string[] = [];
  const sz = attr(firstTag(rPr, "sz") ?? "", "val");
  if (sz && /^\d+$/.test(sz)) css.push(`font-size: ${Number(sz) / 2}pt`);
  const color = attr(firstTag(rPr, "color") ?? "", "val");
  if (color && /^[0-9a-f]{6}$/i.test(color) && color.toLowerCase() !== "000000")
    css.push(`color: #${color}`);
  const caps = onOff(rPr, "caps");
  if (caps) css.push("text-transform: uppercase");
  const va = attr(firstTag(rPr, "vertAlign") ?? "", "val");
  if (va === "superscript") tags.push("sup");
  if (va === "subscript") tags.push("sub");
  const span = css.length ? `<span style="${css.join("; ")}">` : "";
  return {
    key: tags.join(",") + "|" + css.join(";"),
    open: span + tags.map((t) => `<${t}>`).join(""),
    close: [...tags].reverse().map((t) => `</${t}>`).join("") + (span ? "</span>" : ""),
  };
}

function paragraphRuns(pXml: string): string {
  const pieces: Array<{ key: string; open: string; close: string; text: string }> = [];
  const body = pXml.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/, "").replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");
  for (const r of body.matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const inner = r[1]!;
    const rPr = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(inner)?.[0] ?? "";
    const st = runStyle(rPr);
    let text = "";
    for (const t of inner.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) {
      if (t[2] === "tab") text += "&emsp;";
      else if (t[2]) text += "<br>";
      else text += esc(decodeXml(t[1]!));
    }
    if (!text) continue;
    const last = pieces[pieces.length - 1];
    if (last && last.key === st.key) last.text += text;
    else pieces.push({ ...st, text });
  }
  return pieces.map((p) => p.open + p.text + p.close).join("");
}

export function docxXmlToHtml(parts: DocxParts): string {
  const numbering = parseNumbering(parts.numbering);
  const headings = headingStyles(parts.styles);
  const counters = new Map<string, number[]>();

  const renderParagraph = (pXml: string): string => {
    const pPr = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(pXml)?.[0] ?? "";
    const css: string[] = [];
    const jc = attr(firstTag(pPr, "jc") ?? "", "val");
    const align =
      jc === "center" ? "center" : jc === "both" || jc === "distribute" ? "justify"
        : jc === "right" || jc === "end" ? "right" : null;
    if (align) css.push(`text-align: ${align}`);

    let prefix = "";
    let left = 0;
    let first = 0;
    const numPr = /<w:numPr\b[\s\S]*?<\/w:numPr>/.exec(pPr)?.[0];
    if (numPr) {
      const numId = attr(firstTag(numPr, "numId") ?? "", "val") ?? "";
      const ilvl = Number(attr(firstTag(numPr, "ilvl") ?? "", "val") ?? 0);
      const levels = numbering.abstract.get(numbering.nums.get(numId) ?? "");
      const lvl = levels?.get(ilvl);
      if (lvl && numId !== "0") {
        const c = counters.get(numId) ?? [];
        for (let i = 0; i <= ilvl; i++) if (c[i] === undefined) c[i] = (levels?.get(i)?.start ?? 1) - 1;
        c[ilvl] = (c[ilvl] ?? 0) + 1;
        c.length = ilvl + 1;
        counters.set(numId, c);
        prefix = lvl.fmt === "bullet"
          ? "•"
          : lvl.text.replace(/%(\d)/g, (_, d) => {
              const i = Number(d) - 1;
              return fmtNum(c[i] ?? 1, levels?.get(i)?.fmt ?? "decimal");
            });
        left = lvl.indLeft;
        first = -lvl.hanging;
      }
    }
    const ind = firstTag(pPr, "ind");
    if (ind) {
      const l = attr(ind, "left") ?? attr(ind, "start");
      if (l !== null) left = twipToPt(l);
      if (attr(ind, "firstLine") !== null) first = twipToPt(attr(ind, "firstLine"));
      if (attr(ind, "hanging") !== null) first = -twipToPt(attr(ind, "hanging"));
    }
    if (left) css.push(`margin-left: ${left}pt`);
    if (first) css.push(`text-indent: ${first}pt`);
    const sp = firstTag(pPr, "spacing");
    if (sp) {
      const b = attr(sp, "before");
      const a = attr(sp, "after");
      if (b !== null) css.push(`margin-top: ${twipToPt(b)}pt`);
      if (a !== null) css.push(`margin-bottom: ${twipToPt(a)}pt`);
      const line = attr(sp, "line");
      const rule = attr(sp, "lineRule");
      if (line && /^\d+$/.test(line) && (!rule || rule === "auto"))
        css.push(`line-height: ${Math.round((Number(line) / 240) * 100) / 100}`);
    }
    const styleId = attr(firstTag(pPr, "pStyle") ?? "", "val");
    const level = styleId ? headings.get(styleId) : undefined;
    const tag = level ? `h${level}` : "p";
    const content = paragraphRuns(pXml);
    const text = (prefix ? `${esc(prefix)}&ensp;` : "") + content;
    const style = css.length ? ` style="${css.join("; ")}"` : "";
    return `<${tag}${style}>${text || "<br>"}</${tag}>`;
  };

  const renderTable = (tXml: string): string => {
    const rows: string[] = [];
    for (const tr of tXml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)) {
      const cells: string[] = [];
      for (const tc of tr[1]!.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)) {
        const tcPr = /<w:tcPr\b[\s\S]*?<\/w:tcPr>/.exec(tc[1]!)?.[0] ?? "";
        const vm = firstTag(tcPr, "vMerge");
        if (vm && attr(vm, "val") !== "restart") continue;
        const span = attr(firstTag(tcPr, "gridSpan") ?? "", "val");
        const colspan = span && Number(span) > 1 ? ` colspan="${Number(span)}"` : "";
        cells.push(
          `<td${colspan} style="border: 1px solid #000000; padding: 4pt; vertical-align: top">${render(tc[1]!)}</td>`,
        );
      }
      rows.push(`<tr>${cells.join("")}</tr>`);
    }
    return `<table style="border-collapse: collapse; width: 100%"><tbody>${rows.join("")}</tbody></table>`;
  };

  const render = (xml: string): string =>
    blocks(xml).map((b) => (b.kind === "p" ? renderParagraph(b.xml) : renderTable(b.xml))).join("");

  const body = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(parts.document)?.[1] ?? parts.document;
  return render(body.replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g, ""));
}
