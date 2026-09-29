import { arrayMove } from "@dnd-kit/sortable";

export function reconcileColumnOrder(
  saved: string[] | null | undefined,
  available: string[],
  defaults: string[] = available,
) {
  const present = new Set(available);
  const base = saved?.length ? saved : defaults;
  const reconciled = base.filter((key, index) => present.has(key) && base.indexOf(key) === index);
  return reconciled.length ? reconciled : defaults.filter((key) => present.has(key));
}

export function moveColumn(order: string[], activeKey: string, overKey: string) {
  const from = order.indexOf(activeKey);
  const to = order.indexOf(overKey);
  if (from < 0 || to < 0 || from === to) return order;
  return arrayMove(order, from, to);
}
