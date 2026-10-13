// Política de envio dos fluxos da empresa: horário, cotas, deduplicação,
// remetente de e-mail e agenda padrão. Gravação só por admin ativo.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, CardSkeleton } from "@/components/techhire/ui";
import {
  getWorkflowSendPolicy,
  saveWorkflowSendPolicy,
  type SendPolicyInput,
} from "@/lib/workflow-send-policy.functions";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULTS: SendPolicyInput = {
  whatsapp_daily_limit: null,
  email_daily_limit: null,
  dedupe_hours: 0,
  timezone: "America/Sao_Paulo",
  window_start: null,
  window_end: null,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  email_provider: "gmail_owner",
  email_account_id: null,
  default_booking_page_id: null,
};

const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));

export function SendPolicyPanel() {
  const getFn = useServerFn(getWorkflowSendPolicy);
  const saveFn = useServerFn(saveWorkflowSendPolicy);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wf-send-policy"], queryFn: () => getFn() });
  const [form, setForm] = useState<SendPolicyInput>(DEFAULTS);
  useEffect(() => {
    if (!q.data) return;
    const p = q.data.policy;
    setForm(
      p
        ? {
            whatsapp_daily_limit: p.whatsapp_daily_limit,
            email_daily_limit: p.email_daily_limit,
            dedupe_hours: p.dedupe_hours,
            timezone: p.timezone,
            window_start: p.window_start,
            window_end: p.window_end,
            weekdays: p.weekdays,
            email_provider: p.email_provider,
            email_account_id: p.email_account_id,
            default_booking_page_id: p.default_booking_page_id,
          }
        : DEFAULTS,
    );
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Política de envio salva");
      void qc.invalidateQueries({ queryKey: ["wf-send-policy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <CardSkeleton />;
  if (q.isError)
    return (
      <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm">
        Não foi possível carregar a política de envio.{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void q.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  const d = q.data!;
  const ro = !d.canEdit;
  const set = (patch: Partial<SendPolicyInput>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      {ro && (
        <p className="text-sm text-muted-foreground">
          Somente administradores da empresa podem alterar a política de envio.
        </p>
      )}
      <fieldset disabled={ro || save.isPending} className="space-y-4">
        <FormSection
          title="Horário de envio"
          description="Fora do horário, o passo de WhatsApp ou e-mail espera e sai no próximo horário permitido. Vazio = qualquer hora."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="sp-start">Início (hora)</Label>
              <Input
                id="sp-start"
                type="number"
                min={0}
                max={23}
                value={form.window_start ?? ""}
                onChange={(e) => set({ window_start: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-end">Fim (hora)</Label>
              <Input
                id="sp-end"
                type="number"
                min={1}
                max={24}
                value={form.window_end ?? ""}
                onChange={(e) => set({ window_end: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-tz">Fuso horário</Label>
              <Input
                id="sp-tz"
                value={form.timezone}
                onChange={(e) => set({ timezone: e.target.value })}
              />
            </div>
          </div>
          <div role="group" aria-label="Dias permitidos" className="flex flex-wrap gap-3">
            {DAYS.map((label, i) => (
              <label key={label} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={form.weekdays.includes(i)}
                  onCheckedChange={(c) =>
                    set({
                      weekdays: c
                        ? [...new Set([...form.weekdays, i])].sort()
                        : form.weekdays.filter((x) => x !== i),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Cotas comerciais e deduplicação"
          description="Limites diários por canal (últimas 24 h) dos fluxos desta empresa, separados do bloqueio técnico do SDR. Ao atingir, o envio é reagendado."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="sp-wa">WhatsApp por dia</Label>
              <Input
                id="sp-wa"
                type="number"
                min={0}
                placeholder="Sem limite"
                value={form.whatsapp_daily_limit ?? ""}
                onChange={(e) => set({ whatsapp_daily_limit: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-em">E-mails por dia</Label>
              <Input
                id="sp-em"
                type="number"
                min={0}
                placeholder="Sem limite"
                value={form.email_daily_limit ?? ""}
                onChange={(e) => set({ email_daily_limit: numOrNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-dd">Não repetir contato por (horas)</Label>
              <Input
                id="sp-dd"
                type="number"
                min={0}
                max={720}
                value={form.dedupe_hours}
                onChange={(e) =>
                  set({ dedupe_hours: Math.min(720, numOrNull(e.target.value) ?? 0) })
                }
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Remetente de e-mail"
          description="Por qual caixa saem os e-mails dos fluxos desta empresa."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sp-prov">Remetente</Label>
              <Select
                value={form.email_provider}
                onValueChange={(v) =>
                  set({ email_provider: v as SendPolicyInput["email_provider"] })
                }
              >
                <SelectTrigger id="sp-prov">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail_owner">Gmail do dono de cada fluxo</SelectItem>
                  <SelectItem value="gmail_account">Uma caixa Gmail da empresa</SelectItem>
                  <SelectItem value="outlook">
                    Outlook do projeto{d.outlookReady ? "" : " (não conectado)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.email_provider === "gmail_account" && (
              <div className="space-y-1">
                <Label htmlFor="sp-acc">Caixa</Label>
                {d.accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma caixa Gmail conectada nesta empresa.
                  </p>
                ) : (
                  <Select
                    value={form.email_account_id ?? ""}
                    onValueChange={(v) => set({ email_account_id: v })}
                  >
                    <SelectTrigger id="sp-acc">
                      <SelectValue placeholder="Escolha a caixa" />
                    </SelectTrigger>
                    <SelectContent>
                      {d.accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} disabled={!a.connected}>
                          {a.email}
                          {a.connected ? "" : " (desconectada)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          {form.email_provider === "outlook" && !d.outlookReady && (
            <p className="text-sm text-destructive" role="alert">
              O Outlook ainda não está conectado a este projeto: e-mails dos fluxos vão falhar com
              aviso até a conexão ser feita.
            </p>
          )}
        </FormSection>

        <FormSection
          title="Agenda padrão"
          description="Usada pelos blocos “Link de agendamento” sem agenda escolhida."
        >
          <div className="max-w-sm space-y-1">
            <Label htmlFor="sp-book">Agenda</Label>
            <Select
              value={form.default_booking_page_id ?? "__none"}
              onValueChange={(v) => set({ default_booking_page_id: v === "__none" ? null : v })}
            >
              <SelectTrigger id="sp-book">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhuma</SelectItem>
                {d.bookingPages.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.active}>
                    {p.title}
                    {p.active ? "" : " (desativada)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>
      </fieldset>
      {!ro && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar política"}
          </Button>
        </div>
      )}
    </div>
  );
}
