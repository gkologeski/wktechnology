import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Choice } from "./wizard-navigation";

export function Metrics() {
  const [period, setPeriod] = useState("Últimos 7 dias");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Resultados do agente</h3>
          <p className="ap-caption mt-1">DEMONSTRAÇÃO · números ilustrativos, não produção</p>
        </div>
        <Choice
          label="Período"
          value={period}
          options={["Últimos 7 dias", "Últimos 30 dias"]}
          onChange={setPeriod}
        />
      </div>
      <div className="ap-metric-row">
        {[
          ["Conversas", period.includes("30") ? "486" : "128"],
          ["Resolvidas", "84%"],
          ["Tempo médio", "2,4 s"],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 600 100"
        className="h-28 w-full"
        role="img"
        aria-label="Evolução ilustrativa das conversas"
      >
        <path
          d="M0 80C30 80 30 45 60 55S110 80 145 45S200 60 240 40S290 62 330 30S370 46 410 25S470 52 510 20S550 34 600 10"
          fill="none"
          className="stroke-primary"
          strokeWidth="2"
        />
        <path d="M0 95H600" className="stroke-border-subtle" />
      </svg>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-muted-foreground">Receptivo / Prospecção</p>
          <p className="mt-2 font-medium">76 / 52 conversas</p>
        </div>
        <div>
          <p className="text-muted-foreground">Latência p50 / p95</p>
          <p className="mt-2 font-medium">1,8 s / 4,2 s</p>
        </div>
      </div>
      <div className="divide-y divide-border-subtle text-xs">
        {[
          ["Fila", "0,3 s"],
          ["IA", "1,7 s"],
          ["Envio", "0,4 s"],
          ["Transferências humanas", "12"],
          ["Tokens / custo ilustrativo", "24 mil / R$ 3,20"],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-3">
            <span className="text-muted-foreground">{l}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success("Demonstração atualizada; sem consulta de produção")}
      >
        <RefreshCw />
        Atualizar demonstração
      </Button>
    </div>
  );
}
