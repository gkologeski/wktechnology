/**
 * Simulação/plano da normalização E.164 (sem tocar no banco).
 *
 * Entrada: JSON por linha (exportado por `run.sh`):
 *   {"t":"contacts","c":"phone","id":"…","v":"…","country":"Brasil","deleted":false}
 * Saída: CSV para `phone_normalization_items` + resumo de contagens (stdout).
 *
 * Critérios (versão `PHONE_NORMALIZER_VERSION`):
 * - safe_explicit: tinha "+DDI" ou "00"+DDI e há UMA leitura válida.
 * - safe_record_country: sem "+", lido com o país gravado no PRÓPRIO registro
 *   (campo País), uma leitura válida. Nunca usa país do usuário, navegador,
 *   domínio, empresa vinculada ou do workspace.
 * - placeholder: "--", "0", só símbolos → vira vazio (valor original guardado).
 * - already_canonical: já é E.164 válido (nada a fazer, só contado).
 * - revisão (não aplica): region_unknown, invalid, ambiguous, multiple,
 *   letters, bad_plus, too_long, too_short, conflict_duplicate,
 *   extension_without_field.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizePhone, PHONE_NORMALIZER_VERSION } from "../../src/lib/phone/e164";
import { countryFromRecordField } from "../../src/lib/phone/phone-boundary";

type Row = {
  t: string;
  c: string;
  id: string;
  v: string | null;
  country?: string | null;
  deleted?: boolean;
};

const EXT_TABLES = new Set(["contacts", "leads", "companies"]);
const [, , input, output] = process.argv;
if (!input || !output) throw new Error("uso: bun classify.ts rows.jsonl items.csv");

const rows: Row[] = readFileSync(input, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Row);

type Item = {
  t: string;
  c: string;
  id: string;
  original: string;
  proposed: string | null;
  ext: string | null;
  cls: string;
  reason: string;
};

const items: Item[] = [];
const counts: Record<string, Record<string, number>> = {};
const bump = (k: string, cls: string) => {
  counts[k] ??= {};
  counts[k][cls] = (counts[k][cls] ?? 0) + 1;
};

for (const r of rows) {
  const key = `${r.t}.${r.c}`;
  const original = r.v ?? "";
  if (!original.trim()) continue;
  const explicit = normalizePhone(original, { defaultCountry: null });
  let cls: string;
  let proposed: string | null = null;
  let ext: string | null = null;
  let reason = "";
  if (explicit.status === "valid") {
    proposed = explicit.e164;
    ext = explicit.extension;
    cls = proposed === original && !ext ? "already_canonical" : "safe_explicit";
    reason = explicit.via;
  } else if (explicit.status === "invalid" && explicit.reason === "placeholder") {
    cls = "placeholder";
    proposed = null;
    reason = "sem dígitos significativos";
  } else if (explicit.status === "invalid" && explicit.reason === "region_unknown") {
    const rc = countryFromRecordField(r.country ?? null);
    if (!rc) {
      cls = "region_unknown";
      reason = "sem +DDI e sem país no próprio registro";
    } else {
      const byRecord = normalizePhone(original, { defaultCountry: rc });
      if (byRecord.status === "valid") {
        cls = "safe_record_country";
        proposed = byRecord.e164;
        ext = byRecord.extension;
        reason = `país do registro: ${rc}`;
      } else {
        cls = byRecord.status === "invalid" ? byRecord.reason : "invalid";
        reason = `país do registro: ${rc}`;
      }
    }
  } else {
    cls = explicit.status === "invalid" ? explicit.reason : "invalid";
  }
  if (ext && !(EXT_TABLES.has(r.t) && r.c === "phone")) {
    // Sem campo de ramal nesta tabela: não descarta o ramal; fica para revisão.
    cls = "extension_without_field";
    reason = "ramal sem campo próprio";
  }
  items.push({ t: r.t, c: r.c, id: r.id, original, proposed, ext, cls, reason });
}

// Leads: o banco recusa telefone duplicado no workspace. Quem mudaria de
// dígitos e colidiria com outro lead (atual ou proposto) vai para revisão.
{
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const leadsActive = rows.filter((r) => r.t === "leads" && r.c === "phone" && !r.deleted);
  const finalDigits = new Map<string, string>(); // id → dígitos finais
  const byId = new Map(
    items.filter((i) => i.t === "leads" && i.c === "phone").map((i) => [i.id, i]),
  );
  for (const r of leadsActive) {
    const it = byId.get(r.id);
    const applies = it && ["safe_explicit", "safe_record_country", "placeholder"].includes(it.cls);
    finalDigits.set(r.id, digits(applies ? it!.proposed : r.v));
  }
  const counter = new Map<string, number>();
  for (const d of finalDigits.values()) if (d) counter.set(d, (counter.get(d) ?? 0) + 1);
  for (const r of leadsActive) {
    const it = byId.get(r.id);
    if (!it || !["safe_explicit", "safe_record_country"].includes(it.cls)) continue;
    const changesDigits = digits(it.proposed) !== digits(r.v);
    if (changesDigits && (counter.get(digits(it.proposed)) ?? 0) > 1) {
      it.cls = "conflict_duplicate";
      it.reason = "outro lead do workspace teria o mesmo telefone";
    }
  }
}

for (const it of items) bump(`${it.t}.${it.c}`, it.cls);

const esc = (v: string | null) => (v === null ? "" : `"${v.replace(/"/g, '""')}"`);
writeFileSync(
  output,
  items
    .filter((i) => i.cls !== "already_canonical")
    .map((i) =>
      [i.t, i.id, i.c, esc(i.original), esc(i.proposed), esc(i.ext), i.cls, esc(i.reason)].join(
        ",",
      ),
    )
    .join("\n") + "\n",
);
console.log(JSON.stringify({ version: PHONE_NORMALIZER_VERSION, counts }, null, 1));
