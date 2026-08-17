/**
 * Utilitários de datas úteis (seg–sex). Não considera feriados.
 */

/** Último dia útil do mês da data informada (padrão: hoje), em `YYYY-MM-DD`. */
export function lastBusinessDayOfMonth(ref: Date = new Date()): string {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = new Date(y, m + 1, 0); // último dia do mês
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
