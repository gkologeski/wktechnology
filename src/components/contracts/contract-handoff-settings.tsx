import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getContractHandoffSettings,
  saveContractHandoffSettings,
  type HandoffSettings,
} from "@/lib/contracts/handoffs.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
const empty: HandoffSettings = {
  enabled: false,
  legal_user_id: null,
  finance_user_id: null,
  signature_user_id: null,
  operator_user_id: null,
  escalation_user_id: null,
  legal_days: 1,
  finance_days: 1,
  signature_days: 1,
  timezone: "America/Sao_Paulo",
};
export function ContractHandoffSettingsPanel() {
  const p = usePermissions();
  if (!p.can("techcontracts.handoffs.manage.workspace")) return null;
  return <SettingsForm key={p.workspaceId} />;
}
function SettingsForm() {
  const p = usePermissions(),
    get = useServerFn(getContractHandoffSettings),
    save = useServerFn(saveContractHandoffSettings),
    qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const q = useQuery({
    queryKey: ["contract-handoff-settings", p.workspaceId],
    queryFn: () => get(),
    retry: false,
  });
  useEffect(() => {
    if (q.data?.settings) {
      const s = q.data.settings;
      setForm({
        enabled: s.enabled,
        legal_user_id: s.legal_user_id,
        finance_user_id: s.finance_user_id,
        signature_user_id: s.signature_user_id,
        operator_user_id: s.operator_user_id,
        escalation_user_id: s.escalation_user_id,
        legal_days: s.legal_days,
        finance_days: s.finance_days,
        signature_days: s.signature_days,
        timezone: s.timezone,
      });
    }
  }, [q.data]);
  const readonly = !!readViewAs()?.readOnly || readViewAs()?.mode === "role";
  const mutation = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: async () => {
      toast.success("Encaminhamentos atualizados.");
      await qc.invalidateQueries({ queryKey: ["contract-handoff-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const roles = [
    ["legal_user_id", "Revisão jurídica da minuta", "legal"],
    ["finance_user_id", "Preparação e aprovações do contrato", "finance"],
    ["signature_user_id", "Envio para assinatura", "signature"],
    ["escalation_user_id", "Impedimentos e prazos vencidos", "operator"],
    ["operator_user_id", "Operador autorizado da automação", "operator"],
  ] as const;
  return (
    <section
      className="space-y-4 rounded-md border bg-card p-5"
      aria-label="Encaminhamentos automáticos"
    >
      <h2 className="text-lg font-semibold">Encaminhamentos automáticos</h2>
      <p className="text-sm text-muted-foreground">
        Proposta aceita → minuta; minuta aceita → Financeiro; contrato aprovado → conferência dos
        signatários e envio. O sistema cria tarefas e avisos em até dois minutos. Não aprova
        documentos nem dispara convites ao cliente sozinho.
      </p>
      {q.isLoading ? (
        <p role="status">Carregando responsáveis…</p>
      ) : q.isError ? (
        <p role="alert">Não foi possível carregar a configuração.</p>
      ) : (
        <>
          <label className="flex gap-2">
            <Checkbox
              checked={form.enabled}
              disabled={readonly}
              onCheckedChange={(v) => setForm((s) => ({ ...s, enabled: v === true }))}
            />
            Ativar encaminhamentos neste workspace
          </label>
          {roles.map(([field, title, cap]) => (
            <div key={field} className="space-y-1">
              <Label>{title}</Label>
              <Select
                value={form[field] ?? "none"}
                disabled={readonly}
                onValueChange={(v) => setForm((s) => ({ ...s, [field]: v === "none" ? null : v }))}
              >
                <SelectTrigger aria-label={title}>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {q.data?.members.map((m) => (
                    <SelectItem value={m.id} key={m.id}>
                      {m.name}
                      {!m[cap] ? " · conferir permissões" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["legal_days", "Minuta"],
              ["finance_days", "Financeiro"],
              ["signature_days", "Assinatura"],
            ].map(([field, title]) => (
              <div key={field}>
                <Label htmlFor={"sla-" + field}>{title}: dias úteis</Label>
                <Input
                  id={"sla-" + field}
                  type="number"
                  min={1}
                  max={30}
                  disabled={readonly}
                  value={form[field as "legal_days"]}
                  onChange={(e) => setForm((s) => ({ ...s, [field]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <Label htmlFor="handoff-timezone">Fuso horário IANA</Label>
          <Input
            id="handoff-timezone"
            disabled={readonly}
            value={form.timezone}
            onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Dias úteis excluem sábados e domingos; não incluem calendário de feriados. Vencimentos
            notificam o responsável e o escalonamento uma vez. A configuração não concede permissões
            automaticamente.
          </p>
          <Button disabled={readonly || mutation.isPending} onClick={() => mutation.mutate()}>
            Salvar encaminhamentos
          </Button>
        </>
      )}
    </section>
  );
}
