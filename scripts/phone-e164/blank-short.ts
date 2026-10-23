/**
 * Prévia (sem tocar no banco) da correção "até 4 dígitos → em branco" +
 * reclassificação v2 dos itens ainda pendentes da varredura E.164.
 *
 * Entrada:
 *   rows.jsonl  — telefones atuais do workspace (export.sql + `ext`)
 *   open.csv    — itens pendentes da varredura (id,table,row_id,column,original,classification)
 * Saída (diretório):
 *   items.csv        — itens da NOVA execução (backup original → proposto)
 *   resolutions.csv  — item pendente antigo → resolução
 *   reasons.csv      — item pendente antigo → motivo específico v2 (continua pendente)
 *   stdout           — contagens por tabela/campo
 *
 * Critérios (PHONE_NORMALIZER_VERSION):
 * - blank_short: campo não vazio cujo número (ramal fora) tem até
 *   PHONE_BLANK_MAX_DIGITS dígitos → vazio (NULL). Ramal/celular/outro campo
 *   do registro não são tocados.
 * - safe_explicit / safe_record_country (só itens pendentes): leitura v2
 *   única com "+DDI" ou com o país gravado no PRÓPRIO registro (DDI repetido
 *   só com esse país). Ramal só vai para `phone_ext` vazio do mesmo registro.
 * - Todo o resto continua pendente, com motivo específico e candidato
 *   mascarado (hipótese, nunca aplicada).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  isBlankableShortPhone,
  maskPhone,
  normalizePhone,
  phoneMainDigitCount,
  PHONE_NORMALIZER_VERSION,
} from "../../src/lib/phone/e164";
import { countryFromRecordField } from "../../src/lib/phone/phone-boundary";
import { phoneReviewDetail } from "../../src/lib/phone/phone-review";

type Row = {
  t: string;
  c: string;
  id: string;
  v: string | null;
  country?: string | null;
  deleted?: boolean;
  ext?: string | null;
};
type Open = { id: string; t: string; rowId: string; c: string; original: string; cls: string };

const EXT_TABLES = new Set(["contacts", "leads", "companies"]);
const MOBILE_TYPES = new Set(["mobile", "fixed_or_mobile"]);

export type BlankPlanItem = {
  t: string;
  c: string;
  id: string;
  original: string;
  proposed: string | null;
  ext: string | null;
  cls: "blank_short" | "safe_explicit" | "safe_record_country";
  reason: string;
};

/** Parse CSV simples (aspas duplas, vírgula). */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      out.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}

export function planBlankShort(rows: Row[], open: Open[]) {
  const openByKey = new Map(open.map((o) => [`${o.t}|${o.c}|${o.rowId}`, o]));
  const items: BlankPlanItem[] = [];
  const resolutions: { oldId: string; resolution: string }[] = [];
  const reasons: { oldId: string; reason: string }[] = [];
  const stillOpen: Open[] = [];

  for (const r of rows) {
    const original = r.v ?? "";
    if (!original.trim()) continue;
    const key = `${r.t}|${r.c}|${r.id}`;
    const old = openByKey.get(key);
    if (old && old.original !== original) {
      // Valor mudou desde a varredura: não é a mesma pendência; não mexe.
      continue;
    }
    if (isBlankableShortPhone(original)) {
      const n = phoneMainDigitCount(original);
      items.push({
        t: r.t,
        c: r.c,
        id: r.id,
        original,
        proposed: null,
        ext: null,
        cls: "blank_short",
        reason: `${n} dígito(s) no número (ramal fora); até 4 fica em branco`,
      });
      if (old) resolutions.push({ oldId: old.id, resolution: "blank_short" });
      continue;
    }
    if (!old) continue;

    const rc = countryFromRecordField(r.country ?? null);
    let res = normalizePhone(original, { defaultCountry: null });
    let cls: BlankPlanItem["cls"] = "safe_explicit";
    let why = "v2: +DDI explícito";
    if (res.status !== "valid" && rc) {
      const byRecord = normalizePhone(original, {
        defaultCountry: rc,
        allowRepeatedCountryCode: true,
      });
      if (byRecord.status === "valid") {
        res = byRecord;
        cls = "safe_record_country";
        why = `v2: país do registro ${rc}${byRecord.via === "repeated_country_code" ? " (DDI repetido)" : ""}`;
      }
    }
    if (res.status === "valid" && r.c === "mobile_phone" && !MOBILE_TYPES.has(res.type ?? "")) {
      reasons.push({
        oldId: old.id,
        reason: `Número ${maskPhone(res.e164)} não é celular (fixo/especial); não aplicado no campo Celular.`,
      });
      stillOpen.push(old);
      continue;
    }
    if (res.status === "valid") {
      const extOk = !res.extension || (EXT_TABLES.has(r.t) && r.c === "phone");
      const extConflict =
        !!res.extension && !!r.ext && r.ext !== res.extension && EXT_TABLES.has(r.t);
      if (extOk && !extConflict) {
        items.push({
          t: r.t,
          c: r.c,
          id: r.id,
          original,
          proposed: res.e164,
          ext: res.extension,
          cls,
          reason: why,
        });
        resolutions.push({ oldId: old.id, resolution: cls });
        continue;
      }
      reasons.push({
        oldId: old.id,
        reason: extConflict
          ? "Ramal do texto difere do ramal já gravado; não aplicado."
          : "Número válido com ramal, mas este campo não tem ramal próprio; não aplicado.",
      });
      stillOpen.push(old);
      continue;
    }
    const sr = phoneReviewDetail(original, rc);
    if (sr) reasons.push({ oldId: old.id, reason: sr });
    stillOpen.push(old);
  }

  // Leads: o banco recusa telefone duplicado no workspace. Quem mudaria de
  // dígitos e colidiria com outro lead vai para revisão (não aplica).
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const leadPhone = rows.filter((r) => r.t === "leads" && r.c === "phone" && !r.deleted);
  const planned = new Map(
    items.filter((i) => i.t === "leads" && i.c === "phone").map((i) => [i.id, i]),
  );
  const counter = new Map<string, number>();
  for (const r of leadPhone) {
    const it = planned.get(r.id);
    const d = digits(it ? it.proposed : r.v);
    if (d) counter.set(d, (counter.get(d) ?? 0) + 1);
  }
  const dropped = new Set<BlankPlanItem>();
  for (const it of planned.values()) {
    if (it.cls === "blank_short") continue;
    if (digits(it.proposed) !== digits(it.original) && (counter.get(digits(it.proposed)) ?? 0) > 1)
      dropped.add(it);
  }
  const kept = items.filter((i) => !dropped.has(i));
  const droppedIds = new Set([...dropped].map((i) => `${i.t}|${i.c}|${i.id}`));
  const finalRes = resolutions.filter((r) => {
    const o = open.find((x) => x.id === r.oldId);
    return !(o && droppedIds.has(`${o.t}|${o.c}|${o.rowId}`));
  });
  for (const d of dropped) {
    const o = openByKey.get(`${d.t}|${d.c}|${d.id}`);
    if (o) reasons.push({ oldId: o.id, reason: "Outro lead do workspace teria o mesmo telefone." });
  }
  return { items: kept, resolutions: finalRes, reasons };
}

if (import.meta.main) {
  const [, , rowsPath, openPath, outDir] = process.argv;
  if (!rowsPath || !openPath || !outDir)
    throw new Error("uso: bun blank-short.ts rows.jsonl open.csv outdir");
  const rows: Row[] = readFileSync(rowsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
  const open: Open[] = parseCsv(readFileSync(openPath, "utf8"))
    .filter((r) => r.length >= 6)
    .map(([id, t, rowId, c, original, cls]) => ({ id, t, rowId, c, original, cls }));
  const { items, resolutions, reasons } = planBlankShort(rows, open);
  mkdirSync(outDir, { recursive: true });
  const esc = (v: string | null) => (v === null ? "" : `"${v.replace(/"/g, '""')}"`);
  writeFileSync(
    `${outDir}/items.csv`,
    items
      .map((i) =>
        [i.t, i.id, i.c, esc(i.original), esc(i.proposed), esc(i.ext), i.cls, esc(i.reason)].join(
          ",",
        ),
      )
      .join("\n") + "\n",
  );
  writeFileSync(
    `${outDir}/resolutions.csv`,
    resolutions.map((r) => `${r.oldId},${r.resolution}`).join("\n") + "\n",
  );
  writeFileSync(
    `${outDir}/reasons.csv`,
    reasons.map((r) => `${r.oldId},${esc(r.reason)}`).join("\n") + "\n",
  );
  const counts: Record<string, Record<string, number>> = {};
  for (const i of items) {
    const k = `${i.t}.${i.c}`;
    counts[k] ??= {};
    counts[k][i.cls] = (counts[k][i.cls] ?? 0) + 1;
  }
  const byDigits: Record<string, number> = {};
  for (const i of items.filter((x) => x.cls === "blank_short")) {
    const n = String(phoneMainDigitCount(i.original));
    byDigits[n] = (byDigits[n] ?? 0) + 1;
  }
  console.log(
    JSON.stringify(
      {
        version: PHONE_NORMALIZER_VERSION,
        counts,
        blankByDigits: byDigits,
        resolutions: resolutions.length,
        reasonUpdates: reasons.length,
      },
      null,
      1,
    ),
  );
}
