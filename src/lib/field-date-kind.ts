/** SQL column metadata, rather than a property name, determines date editing. */
export function fieldDateKind(dataType?: string | null): "date" | "timestamp" | null {
  if (dataType === "date") return "date";
  if (dataType?.startsWith("timestamp")) return "timestamp";
  return null;
}
