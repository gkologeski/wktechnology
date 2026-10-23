/**
 * Tipo de `<input>` nativo para campos dinâmicos de TEXTO (metadados de
 * formulário, grids, filtros). Nunca devolve data/data-hora: esses campos
 * precisam de um ramo próprio com `IsoDatePicker` / `ActivityDateTimePicker`
 * antes (docs/architecture/date-fields.md).
 *
 * A prova é dupla:
 * - em tempo de compilação, passar um tipo cuja união ainda inclui
 *   "date"/"datetime"/"datetime-local" exige um 2º argumento `never`
 *   (erro de tipo) — ou seja, o chamador precisa ter tratado a data antes;
 * - em execução, qualquer valor de data que escape vira "text".
 *
 * A guarda `src/lib/date-field-guard.test.ts` aceita `type={nativeInputType(x)}`
 * como tipo dinâmico comprovadamente não-data.
 */

export type NativeTextInputType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "url"
  | "password"
  | "search";

type DateLikeType = "date" | "datetime" | "datetime-local";

const SAFE = new Set<string>(["email", "tel", "number", "url", "password", "search"]);

export function nativeInputType<T extends string | null | undefined>(
  type: T,
  ..._dateNotHandled: [Extract<T, DateLikeType>] extends [never] ? [] : [never]
): NativeTextInputType {
  return type && SAFE.has(type) ? (type as NativeTextInputType) : "text";
}
