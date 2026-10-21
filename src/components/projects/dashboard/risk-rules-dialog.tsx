// Regras de risco versionadas do workspace (apresentação). Cada salvamento cria nova versão com motivo.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeletons } from "@/components/techhire/ui";
import { ALERT_RULE_LABEL, ALERT_SEVERITY_LABEL } from "@/lib/projects/dashboard-views.shared";
import type { DashRiskRules, DashRuleConfig } from "@/lib/projects/dashboard-views.types";

const LIMIT_LABEL: Record<string, string> = {
  warn_pct: "Aviso em (% das horas previstas)",
  critical_pct: "Crítico em (%)",
  horizon_days: "Horizonte (dias)",
  days: "Enviadas há mais de (dias)",
  grace_days: "Tolerância após o ganho (dias)",
};

export function RiskRulesDialog({
  open,
  onOpenChange,
  rules,
  loading,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rules: DashRiskRules | undefined;
  loading: boolean;
  saving: boolean;
  onSave: (rules: Record<string, DashRuleConfig>, note: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, DashRuleConfig>>({});
  const [note, setNote] = useState("");
  useEffect(() => {
    if (rules) setDraft(structuredClone(rules.effective));
  }, [rules, open]);
  const set = (k: string, patch: Partial<DashRuleConfig>) =>
    setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }));
  const keys = Object.keys(ALERT_RULE_LABEL);
  const schedule = draft._schedule ?? { enabled: false, tz: "America/Sao_Paulo" };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Regras de risco do workspace</DialogTitle>
          <DialogDescription>
            {rules?.workspace_version
              ? `Versão ${rules.workspace_version.version} em vigor. Salvar cria uma nova versão; as anteriores ficam no histórico.`
              : "Usando as regras padrão. Salvar cria a versão 1."}{" "}
            Sem orçamento de horas no projeto, o consumo não vira risco.
          </DialogDescription>
        </DialogHeader>
        {loading || !rules ? (
          <Skeletons.Card lines={8} />
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim().length >= 5 && rules.can_manage) onSave(draft, note.trim());
            }}
          >
            {keys.map((k) => {
              const r = draft[k] ?? {};
              const limits = Object.keys(LIMIT_LABEL).filter((x) => x in (rules.defaults[k] ?? {}));
              return (
                <fieldset key={k} className="space-y-2 rounded-md border border-border-subtle p-3">
                  <legend className="px-1 text-sm font-medium text-text-primary">
                    {ALERT_RULE_LABEL[k]}
                  </legend>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`rule-${k}-on`}
                        checked={!!r.enabled}
                        onCheckedChange={(v) => set(k, { enabled: v })}
                        disabled={!rules.can_manage}
                      />
                      <Label htmlFor={`rule-${k}-on`}>Ativa</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`rule-${k}-sev`} className="text-xs text-text-secondary">
                        Severidade
                      </Label>
                      <Select
                        value={r.severity ?? "medium"}
                        onValueChange={(v) => set(k, { severity: v as DashRuleConfig["severity"] })}
                        disabled={!rules.can_manage}
                      >
                        <SelectTrigger id={`rule-${k}-sev`} className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["low", "medium", "high"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {ALERT_SEVERITY_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {limits.map((x) => (
                      <div key={x} className="flex items-center gap-2">
                        <Label htmlFor={`rule-${k}-${x}`} className="text-xs text-text-secondary">
                          {LIMIT_LABEL[x]}
                        </Label>
                        <Input
                          id={`rule-${k}-${x}`}
                          type="number"
                          min={0}
                          max={1000}
                          step={1}
                          className="h-8 w-24"
                          value={String((r as Record<string, unknown>)[x] ?? "")}
                          onChange={(e) =>
                            set(k, { [x]: Number(e.target.value) } as Partial<DashRuleConfig>)
                          }
                          disabled={!rules.can_manage}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <fieldset className="space-y-2 rounded-md border border-border-subtle p-3">
              <legend className="px-1 text-sm font-medium text-text-primary">
                Avaliação automática diária
              </legend>
              <div className="flex items-center gap-2">
                <Switch
                  id="rule-schedule-on"
                  checked={!!schedule.enabled}
                  onCheckedChange={(v) =>
                    set("_schedule", { enabled: v, tz: schedule.tz ?? "America/Sao_Paulo" })
                  }
                  disabled={!rules.can_manage}
                />
                <Label htmlFor="rule-schedule-on">
                  Reavaliar uma vez por dia pelo agendador (fuso{" "}
                  {schedule.tz ?? "America/Sao_Paulo"}). Não envia avisos.
                </Label>
              </div>
              <p className="text-xs text-text-tertiary">
                Só funciona depois que a rotina agendada da plataforma estiver ativa na versão
                publicada. Enquanto isso, use “Reavaliar agora”. A última execução aparece na
                Central de atenção.
              </p>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="rules-note">Motivo da mudança</Label>
              <Textarea
                id="rules-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: limite de aviso ajustado com a liderança (mínimo 5 caracteres)."
                maxLength={500}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || note.trim().length < 5 || !rules.can_manage}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Salvar nova versão
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
