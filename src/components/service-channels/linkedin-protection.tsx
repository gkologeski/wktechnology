import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getLinkedinAccount, saveLinkedinOperationPolicy } from "@/lib/unipile/accounts.functions";
import { linkedinPolicySchema } from "@/lib/unipile/operation-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/crm";
import { readViewAs } from "@/lib/view-as-client";
import { toast } from "sonner";
const initial = {
  paused: false,
  daily_messages: 15,
  weekly_messages: 75,
  daily_invites: 5,
  weekly_invites: 20,
  min_interval_seconds: 60,
};
export function LinkedinProtection() {
  const { user } = useAuth();
  const p = usePermissions(),
    get = useServerFn(getLinkedinAccount),
    save = useServerFn(saveLinkedinOperationPolicy);
  const account = useQuery({
    queryKey: ["linkedin-protection", user?.id, p.workspaceId],
    queryFn: () => get(),
    enabled:
      !!user?.id &&
      !!p.workspaceId &&
      !p.isLoading &&
      !p.isError &&
      (p.can("system.linkedin.view.own") || p.can("system.linkedin.view.workspace")),
  });
  const [policy, setPolicy] = useState(initial);
  useEffect(() => {
    const r = linkedinPolicySchema.safeParse(
      (account.data?.account as unknown as { operation_policy?: unknown })?.operation_policy,
    );
    if (r.success) setPolicy(r.data);
  }, [account.data]);
  const update = useMutation({
    mutationFn: () => save({ data: policy }),
    onSuccess: () => {
      void account.refetch();
      toast.success("Proteções salvas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const manage =
    !p.isLoading &&
    !p.isError &&
    !readViewAs()?.readOnly &&
    (p.can("system.linkedin.view.own") || p.can("system.linkedin.view.workspace")) &&
    (p.can("system.linkedin.manage.own") || p.can("system.linkedin.manage.workspace"));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proteções da conta LinkedIn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tetos operacionais conservadores. Não garantem ausência de restrições. As operações do
          TechERP compartilham as cotas; ações feitas diretamente no LinkedIn podem não ser
          contabilizadas.
        </p>
        {account.data?.account?.paused_until &&
        Date.parse(account.data.account.paused_until) > Date.now() ? (
          <p role="status" className="text-sm text-muted-foreground">
            Pausa técnica até {formatDateTime(account.data.account.paused_until)}. A pausa manual
            não antecipa esse prazo.
          </p>
        ) : null}
        {account.data?.account?.status === "disconnected" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Conta desconectada. Verifique a restrição na integradora antes de reconectar.
          </p>
        ) : null}
        {account.isError ? (
          <p role="alert">Não foi possível carregar a conta.</p>
        ) : (
          <fieldset
            disabled={!manage || !account.data?.account || update.isPending}
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                ["daily_messages", "Mensagens por dia", 50],
                ["weekly_messages", "Mensagens em sete dias", 250],
                ["daily_invites", "Convites por dia", 15],
                ["weekly_invites", "Convites em sete dias", 100],
                ["min_interval_seconds", "Intervalo mínimo (segundos)", 3600],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key} className="text-sm">
                {label}
                <Input
                  type="number"
                  min={key === "min_interval_seconds" ? 60 : 0}
                  max={max}
                  value={policy[key]}
                  onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.paused}
                onChange={(e) => setPolicy({ ...policy, paused: e.target.checked })}
              />
              Pausar operações desta conta
            </label>
            <Button onClick={() => update.mutate()}>Salvar proteções</Button>
          </fieldset>
        )}
        <p className="text-xs text-muted-foreground">
          Restrições da integradora mantêm a pausa técnica até o prazo informado. Convites com nota
          possuem um teto conservador adicional de cinco por mês.
        </p>
      </CardContent>
    </Card>
  );
}
