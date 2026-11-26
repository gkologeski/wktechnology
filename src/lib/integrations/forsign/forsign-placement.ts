// Regras puras para localizar o espaço de assinatura de cada signatário no texto do contrato
// e gerar tags únicas de assinatura e rubrica para a API do ForSign.
import type { PdfBlock } from "./forsign-core";

export type PlacementColumn = "full" | "left" | "right";
export type SlotKind = "underline" | "electronic_placeholder";
export type PlacementSource = "identified" | "signature_page";

export type DetectedSignatureSlot = {
  blockIndex: number;
  lineIndex: number;
  column: PlacementColumn;
  kind: SlotKind;
  roleCategory: string | null;
  witnessIndex: number | null;
  rawLabel: string | null;
  prefixBeforeUnderline?: string;
};

export type SignerPlacement = {
  signerIndex: number;
  role: string;
  source: PlacementSource;
  signatureTag: string;
  rubricTag: string;
  slot?: DetectedSignatureSlot;
};

export type SignaturePlacementPlan = {
  placements: SignerPlacement[];
  hasFallbackPage: boolean;
  detectedSlotCount: number;
};

type LogicalLine = {
  blockIndex: number;
  lineIndex: number;
  text: string;
};

type ParsedRole = {
  category: string;
  witnessIndex: number | null;
  plural: boolean;
  rawLabel: string;
  endsWithColon: boolean;
};

/** Tags determinísticas e compatíveis com a validação estrita do ForSign (letras, números e hífen). */
export function signerTagPair(index: number): { signatureTag: string; rubricTag: string } {
  const n = index + 1;
  return { signatureTag: `#TE-ASSINA-${n}`, rubricTag: `#TE-RUBRICA-${n}` };
}

/** Remove o apêndice de manifesto adicionado por hiring_contract_esign_body em pacotes com anexos. */
export function stripPackageAppendix(html: string): string {
  const idx = html.indexOf("<!--techerp:contract-package:");
  return idx >= 0 ? html.slice(0, idx) : html;
}

function normalizeRoleText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseWitnessNumber(norm: string): number | null {
  const m =
    /\bTESTEMUNHA\s*(?:N[Oº°.]?\s*)?(\d+)\b/.exec(norm) ??
    /\b(\d+)[Aº°.]?\s*TESTEMUNHA\b/.exec(norm);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function classifySignerRole(role: string): { category: string; witnessIndex: number | null } {
  const norm = normalizeRoleText(role);
  if (/\bCONTRATANTE\b/.test(norm)) return { category: "CONTRATANTE", witnessIndex: null };
  if (/\b(CONTRATAD[OA]|PRESTADOR[A]?|FORNECEDOR[A]?)\b/.test(norm))
    return { category: "CONTRATADO", witnessIndex: null };
  if (/\bTESTEMUNH(A|AS)\b/.test(norm))
    return { category: "TESTEMUNHA", witnessIndex: parseWitnessNumber(norm) };
  return { category: norm, witnessIndex: null };
}

const IGNORED_PROSE_HINT = /\b(CLAUSULA|AS PARTES|FIRMAM|INSTRUMENTO|ADMITIDA|ELETRONICA|FORO)\b/;

function extractLineRoles(text: string): ParsedRole[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) return [];
  const norm = normalizeRoleText(trimmed);
  const words = norm.split(" ").filter(Boolean);
  if (words.length > 10 || IGNORED_PROSE_HINT.test(norm)) return [];
  if (/\.\s+[A-Z]/.test(norm)) return [];
  const endsWithColon = trimmed.endsWith(":");
  const found: Array<{ pos: number; role: ParsedRole }> = [];
  const push = (pos: number, category: string, witnessIndex: number | null, plural: boolean) =>
    found.push({ pos, role: { category, witnessIndex, plural, rawLabel: norm, endsWithColon } });

  const contratante = /\bCONTRATANTE\b/.exec(norm);
  if (contratante) push(contratante.index, "CONTRATANTE", null, false);

  const contratado = /\b(CONTRATAD[OA]|PRESTADOR[A]?|FORNECEDOR[A]?)\b/.exec(norm);
  if (contratado) push(contratado.index, "CONTRATADO", null, false);

  const testemunha = /\bTESTEMUNH(A|AS)\b/.exec(norm);
  if (testemunha) {
    const plural = testemunha[1] === "AS";
    push(testemunha.index, "TESTEMUNHA", plural ? null : parseWitnessNumber(norm), plural);
  }

  if (found.length > 0) {
    found.sort((a, b) => a.pos - b.pos);
    return found.map((f) => f.role);
  }

  const cleanCustom = norm
    .replace(/[:()\-–—.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    cleanCustom.length >= 4 &&
    words.length <= 5 &&
    !/^(NOME|CPF|RG|CNPJ|DATA|LOCAL|E-?MAIL|CARGO|ENDERECO|TELEFONE|REPRESENTANTE|ASSINATURA)/.test(
      cleanCustom,
    ) &&
    (endsWithColon ||
      /\b(INTERVENIENTE|ANUENTE|FIADOR|AVALISTA|SOCIO|REPRESENTANTE LEGAL)\b/.test(cleanCustom))
  ) {
    return [
      {
        category: cleanCustom,
        witnessIndex: null,
        plural: false,
        rawLabel: cleanCustom,
        endsWithColon,
      },
    ];
  }
  return [];
}

const DATE_BLANK_RE = /\bde\s+_{3,}|_{3,}\s+de\s+_{3,}/i;
const NON_SIGNATURE_FIELD_RE =
  /^\s*(?:nome|cpf|rg|cnpj|e-?mail|cargo|endere[çc]o|data|telefone|local|cidade|uf)\s*:/i;
const ELECTRONIC_PLACEHOLDER_RE = /^\s*\(?\s*assinatura\s+(?:eletr[ôo]nica|digital)\s*\)?\s*$/i;
const TWO_WITNESS_SIGN_RE =
  /1\s*[.)]?\s*assinatura\s*:?\s*_{4,}[\s\S]*2\s*[.)]?\s*assinatura\s*:?\s*_{4,}/i;

function makeSlot(
  line: LogicalLine,
  column: PlacementColumn,
  kind: SlotKind,
  roleCategory: string | null = null,
  witnessIndex: number | null = null,
  rawLabel: string | null = null,
  prefixBeforeUnderline?: string,
): DetectedSignatureSlot {
  return {
    blockIndex: line.blockIndex,
    lineIndex: line.lineIndex,
    column,
    kind,
    roleCategory,
    witnessIndex,
    rawLabel,
    ...(prefixBeforeUnderline ? { prefixBeforeUnderline } : {}),
  };
}

function detectSlotsInLine(line: LogicalLine): DetectedSignatureSlot[] {
  const t = line.text.trim();
  if (!t) return [];
  if (ELECTRONIC_PLACEHOLDER_RE.test(t)) return [makeSlot(line, "full", "electronic_placeholder")];
  if (!/_{4,}/.test(t) || DATE_BLANK_RE.test(t)) return [];
  if (NON_SIGNATURE_FIELD_RE.test(t) && !/assinatura/i.test(t)) return [];

  if (TWO_WITNESS_SIGN_RE.test(t)) {
    return [
      makeSlot(line, "left", "underline", "TESTEMUNHA", 1, "TESTEMUNHA 1"),
      makeSlot(line, "right", "underline", "TESTEMUNHA", 2, "TESTEMUNHA 2"),
    ];
  }

  const runs = [...t.matchAll(/_{5,}/g)];
  if (runs.length === 2 && /^(?:\s*(?:assinatura\s*:?\s*)?_{5,}\s*){2}$/i.test(t)) {
    return [makeSlot(line, "left", "underline"), makeSlot(line, "right", "underline")];
  }

  const firstRun = runs[0];
  if (!firstRun || runs.length !== 1) return [];
  const before = t.slice(0, firstRun.index).trim();
  const after = t.slice((firstRun.index ?? 0) + firstRun[0].length).trim();
  if (after.length > 0) return [];
  if (
    before.length > 0 &&
    !/^(?:(?:\d+\s*[.)]?\s*)?(?:representante|assinatura|contratante|contratad[oa]|testemunha(?:\s*\d+)?|interveniente(?:\s+anuente)?)\s*:?)$/i.test(
      before,
    )
  ) {
    return [];
  }
  const inlineRole = before ? (extractLineRoles(before)[0] ?? null) : null;
  return [
    makeSlot(
      line,
      "full",
      "underline",
      inlineRole?.category ?? null,
      inlineRole?.witnessIndex ?? null,
      inlineRole?.rawLabel ?? null,
      t.slice(0, firstRun.index) || undefined,
    ),
  ];
}

/** Detecta todos os espaços de assinatura (`_________` ou `(assinatura eletrônica)`) nos blocos do contrato. */
export function detectSignatureSlots(blocks: PdfBlock[]): DetectedSignatureSlot[] {
  const lines: LogicalLine[] = [];
  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const b = blocks[bIdx];
    if (!b) continue;
    if (/^Anexos integrantes do contrato$/i.test(b.text.trim())) break;
    const parts = b.text.split("\n");
    for (let lIdx = 0; lIdx < parts.length; lIdx++) {
      const text = (parts[lIdx] ?? "").trim();
      if (text) lines.push({ blockIndex: bIdx, lineIndex: lIdx, text });
    }
  }

  const lineSlots = lines.map((line) => detectSlotsInLine(line));
  const lineRoles = lines.map((line) => extractLineRoles(line.text));

  const findRoleAbove = (lineIdx: number): ParsedRole[] | null => {
    let seenSlot = false;
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 5); j--) {
      const roles = lineRoles[j];
      if (roles && roles.length > 0) {
        if (seenSlot && !roles.some((r) => r.plural)) return null;
        return roles;
      }
      const slotsAtJ = lineSlots[j];
      if (slotsAtJ && slotsAtJ.length > 0) {
        seenSlot = true;
        continue;
      }
      if ((lines[j]?.text.length ?? 0) > 100) return null;
    }
    return null;
  };

  const findRoleBelow = (lineIdx: number): ParsedRole[] | null => {
    for (let j = lineIdx + 1; j <= Math.min(lines.length - 1, lineIdx + 3); j++) {
      const slotsAtJ = lineSlots[j];
      if (slotsAtJ && slotsAtJ.length > 0) return null;
      const roles = lineRoles[j];
      if (roles && roles.length > 0) {
        if (roles.every((r) => r.endsWithColon)) return null;
        return roles;
      }
      if ((lines[j]?.text.length ?? 0) > 100) return null;
    }
    return null;
  };

  let preferAbove: boolean | null = null;
  for (let i = 0; i < lines.length; i++) {
    const slotsAtI = lineSlots[i];
    if (!slotsAtI || slotsAtI.length === 0 || slotsAtI.every((s) => s.roleCategory !== null))
      continue;
    const above = findRoleAbove(i);
    const below = findRoleBelow(i);
    if (above && !below) preferAbove = true;
    else if (below && !above) preferAbove = false;
    else if (above && below) preferAbove = above.some((r) => r.endsWithColon);
    break;
  }

  const detected: DetectedSignatureSlot[] = [];
  for (let i = 0; i < lines.length; i++) {
    const slotsAtI = lineSlots[i];
    if (!slotsAtI || slotsAtI.length === 0) continue;
    const needLabel = slotsAtI.some((s) => s.roleCategory === null);
    if (needLabel) {
      const above = findRoleAbove(i);
      const below = findRoleBelow(i);
      const chosen = preferAbove === false ? (below ?? above) : (above ?? below);
      if (chosen && chosen.length > 0) {
        if (slotsAtI.length === 2 && chosen.length === 2) {
          slotsAtI.forEach((slot, idx) => {
            const r = chosen[idx];
            if (slot.roleCategory === null && r) {
              slot.roleCategory = r.category;
              slot.witnessIndex = r.witnessIndex;
              slot.rawLabel = r.rawLabel;
            }
          });
        } else if (chosen.length === 1 && chosen[0]) {
          const r = chosen[0];
          for (const slot of slotsAtI) {
            if (slot.roleCategory === null) {
              slot.roleCategory = r.category;
              slot.witnessIndex = r.witnessIndex;
              slot.rawLabel = r.rawLabel;
            }
          }
        }
      }
    }
    detected.push(...slotsAtI);
  }
  return detected;
}

function matchesCustomRole(slot: DetectedSignatureSlot, signerCategory: string): boolean {
  if (!slot.roleCategory) return false;
  if (slot.roleCategory === signerCategory) return true;
  if (
    slot.rawLabel &&
    (slot.rawLabel.includes(signerCategory) || signerCategory.includes(slot.rawLabel))
  )
    return true;
  return false;
}

/** Associa cada signatário ao espaço detectado pelo papel e ordem; qualquer falta ou ambiguidade vai para página de assinaturas. */
export function planSignaturePlacementsFromSlots(
  slots: readonly DetectedSignatureSlot[],
  signers: readonly { role: string }[],
): SignaturePlacementPlan {
  const usedSlotIndices = new Set<number>();
  const witnessSlots = slots
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ slot }) => slot.roleCategory === "TESTEMUNHA");

  const placements: SignerPlacement[] = signers.map((signer, signerIndex) => {
    const { signatureTag, rubricTag } = signerTagPair(signerIndex);
    const { category, witnessIndex } = classifySignerRole(signer.role);

    if (category === "TESTEMUNHA") {
      let picked: { slot: DetectedSignatureSlot; idx: number } | undefined;
      if (witnessIndex !== null) {
        const exact = witnessSlots.filter(
          ({ slot, idx }) => !usedSlotIndices.has(idx) && slot.witnessIndex === witnessIndex,
        );
        if (exact.length === 1) picked = exact[0];
        else if (exact.length === 0) {
          const unnumbered = witnessSlots.filter(
            ({ slot, idx }) => !usedSlotIndices.has(idx) && slot.witnessIndex === null,
          );
          const target = witnessSlots.filter(({ slot }) => slot.witnessIndex === null)[
            witnessIndex - 1
          ];
          if (target && !usedSlotIndices.has(target.idx)) picked = target;
          else if (unnumbered.length > 0 && witnessIndex <= witnessSlots.length)
            picked = unnumbered[0];
        }
      } else {
        const remaining = witnessSlots.filter(({ idx }) => !usedSlotIndices.has(idx));
        picked = remaining[0];
      }
      if (picked) {
        usedSlotIndices.add(picked.idx);
        return {
          signerIndex,
          role: signer.role,
          source: "identified",
          signatureTag,
          rubricTag,
          slot: picked.slot,
        };
      }
      return { signerIndex, role: signer.role, source: "signature_page", signatureTag, rubricTag };
    }

    const matching = slots
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot, idx }) => !usedSlotIndices.has(idx) && matchesCustomRole(slot, category));

    if (matching.length === 1 && matching[0]) {
      usedSlotIndices.add(matching[0].idx);
      return {
        signerIndex,
        role: signer.role,
        source: "identified",
        signatureTag,
        rubricTag,
        slot: matching[0].slot,
      };
    }

    return { signerIndex, role: signer.role, source: "signature_page", signatureTag, rubricTag };
  });

  return {
    placements,
    hasFallbackPage: placements.some((p) => p.source === "signature_page"),
    detectedSlotCount: slots.length,
  };
}

/** Planeja o posicionamento de cada signatário diretamente a partir dos blocos do contrato. */
export function planSignaturePlacements(
  blocks: PdfBlock[],
  signers: readonly { role: string }[],
): SignaturePlacementPlan {
  return planSignaturePlacementsFromSlots(detectSignatureSlots(blocks), signers);
}
