// Exportação CSV do dashboard consolidado.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { downloadCsv, toCsv } from "@/lib/csv-export";
import type { HomeDashboardResponse } from "@/lib/home/dashboard.functions";

const MODULE_LABEL: Record<string, string> = {
  crm: "CRM",
  ats: "ATS",
  contracts: "Contratos",
  projects: "Projetos",
  finance: "Financeiro",
  people: "Pessoas",
};

type Row = { modulo: string; indicador: string; valor: string; detalhe: string };

export function exportDashboardCsv(data: HomeDashboardResponse, range: { from: Date; to: Date }) {
  const rows: Row[] = [];
  for (const s of data.sections) {
    for (const k of s.kpis) {
      rows.push({
        modulo: MODULE_LABEL[s.moduleId] ?? s.moduleId,
        indicador: k.label,
        valor: String(k.value),
        detalhe: k.hint ?? "",
      });
    }
  }
  const csv = toCsv(rows, [
    { header: "Módulo", value: (r) => r.modulo },
    { header: "Indicador", value: (r) => r.indicador },
    { header: "Valor", value: (r) => r.valor },
    { header: "Detalhe", value: (r) => r.detalhe },
  ]);
  const stamp = `${format(range.from, "yyyy-MM-dd", { locale: ptBR })}_${format(range.to, "yyyy-MM-dd", { locale: ptBR })}`;
  downloadCsv(`dashboard_${stamp}.csv`, csv);
}
