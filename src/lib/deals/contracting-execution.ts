export type JourneyServiceState = { status: string; billing_hold?: string | null };

/** Resume somente os serviços visíveis; execução não certifica aceite ou assinatura. */
export function journeyExecutionState(rows: readonly JourneyServiceState[] | null) {
  if (rows === null)
    return { complete: false, completed: 0, total: 0, held: 0, label: "Execução não consultada" };
  const completed = rows.filter((row) => row.status === "completed").length;
  const held = rows.filter((row) => row.billing_hold === "awaiting_signature").length;
  return {
    complete: rows.length > 0 && completed === rows.length,
    completed,
    total: rows.length,
    held,
    label: rows.length
      ? `Execução: ${completed} de ${rows.length} serviço(s) concluído(s)`
      : "Nenhum serviço visível vinculado",
  };
}
