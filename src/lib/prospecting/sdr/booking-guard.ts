// Barreira contra reunião "confirmada" só no texto: a Lia só pode afirmar que
// marcou/remarcou quando a agenda devolveu status=confirmed neste turno.

const CLAIM_RE =
  /\b(agendad[oa]s?|marcad[oa]s?|confirmad[oa]s?|reservad[oa]s?|remarcad[oa]s?)\b|\bt[aá] (marcado|agendado|confirmado)\b/i;

/** A resposta afirma que uma reunião foi marcada/confirmada? */
export function claimsBooking(reply: string): boolean {
  return CLAIM_RE.test(reply);
}

/** Alguma saída de calendar.book/reschedule deste turno confirmou o evento? */
export function hasConfirmedBooking(outputs: { tool: string; out: unknown }[]): boolean {
  return outputs.some(
    (o) =>
      /calendar__(book|reschedule)/.test(o.tool) &&
      !!o.out &&
      typeof o.out === "object" &&
      (o.out as { status?: unknown }).status === "confirmed",
  );
}

const DAYS: [RegExp, number][] = [
  [/\b(dom|domingo)\b/, 0],
  [/\b(2\s*a|seg|segunda)(-feira)?\b/, 1],
  [/\b(3\s*a|ter|terca)(-feira)?\b/, 2],
  [/\b(4\s*a|qua|quarta)(-feira)?\b/, 3],
  [/\b(5\s*a|qui|quinta)(-feira)?\b/, 4],
  [/\b(6\s*a|sex|sexta)(-feira)?\b/, 5],
  [/\b(sab|sabado)\b/, 6],
];

/**
 * Resolve escolhas curtas ("6a", "sexta", "a segunda", "a última", "2") contra
 * as opções vigentes. Devolve a posição (1..n) só quando a escolha é única.
 */
export function resolveChoice(
  text: string,
  options: { position: number; start: string; timezone: string }[],
): number | null {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t || !options.length) return null;
  const n = t.match(/^(?:opcao\s*)?([1-3])\s*o?$/);
  if (n) return options.some((o) => o.position === Number(n[1])) ? Number(n[1]) : null;
  if (/\bprimeira\b/.test(t)) return options[0]?.position ?? null;
  if (/\bultima\b/.test(t)) return options[options.length - 1]?.position ?? null;
  if (/\b(a |o )?(segunda op|segundo)\b/.test(t)) return options[1]?.position ?? null;
  if (/\bterceira\b/.test(t)) return options[2]?.position ?? null;
  for (const [re, wd] of DAYS) {
    if (!re.test(t)) continue;
    const hits = options.filter((o) => weekday(o.start, o.timezone) === wd);
    return hits.length === 1 ? hits[0].position : null;
  }
  return null;
}

function weekday(iso: string, tz: string): number {
  const w = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(
    new Date(iso),
  );
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
}
