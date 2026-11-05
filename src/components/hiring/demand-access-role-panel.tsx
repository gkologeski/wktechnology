import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { loadDemandAccessRole, saveDemandAccessRole } from "@/lib/hiring/employment.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export function DemandAccessRolePanel({
  jobId,
  onChanged,
}: {
  jobId: string;
  onChanged: () => Promise<void>;
}) {
  const { can } = usePermissions();
  const load = useServerFn(loadDemandAccessRole),
    save = useServerFn(saveDemandAccessRole);
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["hiring-demand-access-role", jobId],
    queryFn: () => load({ data: { jobId } }),
    enabled: can("techhire.hiring_demands.view.workspace"),
    staleTime: 0,
    retry: false,
  });
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false);
  if (!can("techhire.hiring_demands.view.workspace")) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cargo para o modelo de acesso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          O cargo integra a revisão da demanda. Alterá-lo exige nova aprovação; a admissão aceita
          somente modelos deste cargo.
        </p>
        {error ? (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        ) : data ? (
          <>
            <Select
              value={selected || data.role_id || undefined}
              disabled={busy || !can("techhire.hiring_demands.update.workspace")}
              onValueChange={setSelected}
            >
              <SelectTrigger aria-label="Cargo para acesso na demanda">
                <SelectValue placeholder="Escolha o cargo antes da admissão" />
              </SelectTrigger>
              <SelectContent>
                {data.roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("techhire.hiring_demands.update.workspace") && (
              <Button
                variant="outline"
                disabled={busy || !selected || selected === data.role_id}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await save({ data: { jobId, revision: data.revision, roleId: selected } });
                    await Promise.all([
                      qc.invalidateQueries({ queryKey: ["hiring-demand"] }),
                      qc.invalidateQueries({ queryKey: ["hiring-demand-access-role", jobId] }),
                      qc.invalidateQueries({ queryKey: ["recruitment-authorization", jobId] }),
                    ]);
                    await onChanged();
                    toast.success("Cargo salvo na nova revisão da demanda.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Salvar cargo na demanda
              </Button>
            )}
          </>
        ) : (
          <p>Carregando cargo…</p>
        )}
      </CardContent>
    </Card>
  );
}
