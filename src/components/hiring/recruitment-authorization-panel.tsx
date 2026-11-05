import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRecruitmentAuthorization,
  linkRecruitmentContract,
} from "@/lib/hiring/recruitment.functions";
export function RecruitmentAuthorizationPanel({
  jobId,
  onChanged,
}: {
  jobId: string;
  onChanged: () => Promise<void>;
}) {
  const load = useServerFn(getRecruitmentAuthorization),
    link = useServerFn(linkRecruitmentContract);
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["recruitment-authorization", jobId],
    queryFn: () => load({ data: { jobId } }),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const save = async () => {
    if (!data || !selected) return;
    setBusy(true);
    try {
      await link({ data: { jobId, revision: data.revision, contractId: selected } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["hiring-demand", jobId] }),
        qc.invalidateQueries({ queryKey: ["recruitment-authorization", jobId] }),
      ]);
      await onChanged();
      toast.success("Contrato vinculado. Confira a nova revisão da demanda.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao vincular contrato.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Autorização para iniciar recrutamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p>Conferindo requisitos…</p>
        ) : error ? (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        ) : data ? (
          <>
            <p className="font-medium">
              {data.ready
                ? data.governed
                  ? "Requisitos atuais atendidos"
                  : "Vaga histórica preservada"
                : "Recrutamento bloqueado"}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.reason ??
                "Cada operação reconfere os requisitos; a liberação não executa contratação, convite ou faturamento."}
            </p>
            {data.contracts.length > 0 && (
              <>
                <Label>Contrato comercial da demanda</Label>
                <Select
                  value={selected || data.contract_id || undefined}
                  onValueChange={setSelected}
                  disabled={busy || !can("techhire.hiring_demands.update.workspace")}
                >
                  <SelectTrigger aria-label="Contrato comercial da demanda">
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.number ?? c.title}
                        {c.reason ? " · pendente" : " · assinatura válida"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {can("techhire.hiring_demands.update.workspace") && (
                  <Button
                    variant="outline"
                    disabled={busy || !selected || selected === data.contract_id}
                    onClick={save}
                  >
                    Vincular contrato
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Alterar o contrato exige nova aprovação da demanda.
                </p>
              </>
            )}
            {data.kind === "hunting" && (
              <p className="text-sm">
                Hunting: contratação pelo cliente; sem criação automática de pessoa interna,
                alocação ou acesso.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
