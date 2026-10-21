// Capacidade da pessoa na alocação: mostra as outras alocações vigentes no período, o pico de %
// por dia e pede justificativa quando a soma passa de 100% (o banco aplica o limite da política).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAllocationCapacity } from "@/lib/people/allocations.functions";

export type AllocationCapacityValue = {
  hoursPerWeek: string;
  canTrackTime: boolean;
  justification: string;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "aberta");

export function AllocationCapacityFields({
  personId,
  excludeId,
  startsAt,
  endsAt,
  pct,
  active,
  value,
  onChange,
}: {
  personId: string;
  excludeId: string | null;
  startsAt: string;
  endsAt: string;
  pct: number;
  active: boolean;
  value: AllocationCapacityValue;
  onChange: (v: AllocationCapacityValue) => void;
}) {
  const capacityFn = useServerFn(getAllocationCapacity);
  const from = startsAt || new Date().toISOString().slice(0, 10);
  const to = endsAt || addDays(from, 365);
  const q = useQuery({
    queryKey: ["allocation-capacity", personId, from, to, excludeId],
    queryFn: () => capacityFn({ data: { person_id: personId, from, to, exclude_id: excludeId } }),
    enabled: !!personId && active,
  });
  const peak = (q.data?.max_pct ?? 0) + pct;
  const over = active && peak > 100;

  return (
    <div className="space-y-3 rounded-md border p-3 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="alloc-hours-week">Horas contratadas por semana (opcional)</Label>
          <Input
            id="alloc-hours-week"
            type="number"
            min="0"
            max="168"
            value={value.hoursPerWeek}
            onChange={(e) => onChange({ ...value, hoursPerWeek: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            id="alloc-can-track"
            checked={value.canTrackTime}
            onCheckedChange={(v) => onChange({ ...value, canTrackTime: v })}
          />
          <Label htmlFor="alloc-can-track">Pode apontar horas no projeto</Label>
        </div>
      </div>
      {active && (
        <div className="text-sm" aria-live="polite">
          {q.isLoading ? (
            <p className="text-muted-foreground">Calculando capacidade…</p>
          ) : q.isError ? (
            <p className="text-muted-foreground">Não foi possível calcular a capacidade.</p>
          ) : (
            <>
              <p className={over ? "font-medium text-destructive" : "text-muted-foreground"}>
                Pico no período com esta alocação: {Math.round(peak)}%
                {q.data?.schedule_configured === false &&
                  " · jornada não configurada no cadastro da pessoa"}
              </p>
              {(q.data?.allocations ?? []).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {q.data!.allocations.map((a) => (
                    <li key={a.id}>
                      {a.project_name ?? "Sem projeto"} · {a.allocation_pct ?? 100}% ·{" "}
                      {br(a.starts_at)} → {br(a.ends_at)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {over && (
        <div className="space-y-2">
          <Label htmlFor="alloc-justification">Justificativa para exceder a capacidade</Label>
          <Input
            id="alloc-justification"
            value={value.justification}
            onChange={(e) => onChange({ ...value, justification: e.target.value })}
            placeholder="Obrigatória quando a soma passa do limite"
          />
        </div>
      )}
    </div>
  );
}
