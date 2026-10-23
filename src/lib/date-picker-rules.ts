/**
 * Regras puras do `DatePicker` (navegação e validação de formulário),
 * separadas do componente para teste e para manter o arquivo de UI só com
 * componentes.
 */
import { isDayWithin } from "@/lib/iso-date";

/**
 * Janela das listas de mês/ano quando o campo NÃO tem limites de negócio.
 * Não é limite: a janela acompanha o mês exibido e o valor escolhido, então
 * setas e listas sempre alcançam datas mais distantes (ex.: 1880, 2200).
 */
export const YEAR_WINDOW_BACK = 130;
export const YEAR_WINDOW_AHEAD = 100;

/** Primeiro/último mês navegável: limites reais ou janela móvel. */
export function calendarNavigationBounds(
  shown: Date,
  opts: { value?: Date | null; min?: Date | null; max?: Date | null; now?: Date },
): { startMonth: Date; endMonth: Date } {
  const nowY = (opts.now ?? new Date()).getFullYear();
  const years = [nowY, shown.getFullYear(), ...(opts.value ? [opts.value.getFullYear()] : [])];
  return {
    startMonth: opts.min ?? new Date(Math.min(...years) - YEAR_WINDOW_BACK, 0, 1),
    endMonth: opts.max ?? new Date(Math.max(...years) + YEAR_WINDOW_AHEAD, 11, 31),
  };
}

/** Mensagem da validação de formulário (vazio obrigatório / fora dos limites). */
export function datePickerValidationMessage(opts: {
  value?: Date | null;
  required?: boolean;
  min?: Date | null;
  max?: Date | null;
}): string {
  if (!opts.value) return opts.required ? "Informe a data." : "";
  if (!isDayWithin(opts.value, { min: opts.min, max: opts.max }))
    return "Data fora do período permitido.";
  return "";
}
