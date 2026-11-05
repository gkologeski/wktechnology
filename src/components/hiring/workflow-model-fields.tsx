import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { loadHiringModels } from "@/lib/hiring/employment.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
export function HiringWorkflowModelFields({
  modelId,
  entityId,
  onChange,
}: {
  modelId: string;
  entityId: string;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const { can } = usePermissions();
  const load = useServerFn(loadHiringModels);
  const { data, error } = useQuery({
    queryKey: ["hiring-access-models"],
    queryFn: () => load(),
    enabled: can("system.hiring_access.view.workspace"),
    retry: false,
  });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Admissão integrada</p>
      <p className="text-xs text-muted-foreground">
        Para demandas governadas, selecione modelo revisado e entidade. Atendimento a cliente herda
        o CNPJ e período do contrato comercial; nenhuma permissão comercial extra é acrescentada.
      </p>
      {error && <p role="alert">{error.message}</p>}
      <Label>Modelo de acesso</Label>
      <Select value={modelId || undefined} onValueChange={(v) => onChange({ access_model_id: v })}>
        <SelectTrigger aria-label="Modelo de acesso do workflow">
          <SelectValue placeholder="Selecione modelo ativo" />
        </SelectTrigger>
        <SelectContent>
          {data?.models
            .filter((m) => m.active)
            .map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Label>Entidade WK (interno / gestão compartilhada)</Label>
      <Select value={entityId || undefined} onValueChange={(v) => onChange({ entity_id: v })}>
        <SelectTrigger aria-label="Entidade WK do workflow">
          <SelectValue placeholder="Selecione entidade" />
        </SelectTrigger>
        <SelectContent>
          {data?.entities.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
