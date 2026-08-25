import type { ReactNode } from "react";
import * as Recharts from "recharts";

export type RechartsKit = typeof Recharts;

/**
 * Renderizador carregado sob demanda: mantém o pacote de gráficos fora do
 * bundle inicial das rotas que o utilizam.
 */
export default function ChartKitRenderer({ render }: { render: (kit: RechartsKit) => ReactNode }) {
  return <>{render(Recharts)}</>;
}
