// Diálogo de desfecho de contratação (Fase 2 do ciclo de contratação via Workflows).
// Componente presentacional: coleta os dados e devolve via onConfirm. Quem chama
// grava a candidatura; os Workflows do workspace fazem o resto (pessoa, contrato,
// financeiro, acesso), sem cascata acoplada à tela.
import { useEffect, useState } from "react";
import { Building2, Handshake, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/techhire/ui";
import { ActivityDateTimePicker } from "@/components/activity/activity-date-time-picker";
import { cn } from "@/lib/utils";

export type HiringModel = "internal" | "outsourcing" | "hunting";
export type HiringModality = "monthly" | "hourly" | "mixed";
export type HiringEmployment = "pj" | "clt" | "contractor" | "intern" | "other";

export type HiringOutcome = {
  model: HiringModel;
  department?: string;
  modality?: HiringModality;
  employment_type?: HiringEmployment;
  role_title?: string;
  start_date?: string;
  monthly_amount?: number;
  hourly_rate?: number;
  fee_amount?: number;
  notes?: string;
};

const MODELS: Array<{ value: HiringModel; label: string; hint: string; icon: typeof Users }> = [
  { value: "internal", label: "Interna", hint: "Vai trabalhar para nós", icon: Users },
  {
    value: "outsourcing",
    label: "Outsourcing",
    hint: "Alocado em um cliente",
    icon: Building2,
  },
  { value: "hunting", label: "Hunting", hint: "Contratado pelo cliente", icon: Handshake },
];

const AREAS = ["Comercial", "Técnica", "RH", "Financeiro", "Administrativo"];

const MODALITY_LABELS: Record<HiringModality, string> = {
  monthly: "Mensalista fixo",
  hourly: "Freelancer / por hora",
  mixed: "Misto (fixo + variável)",
};

const EMPLOYMENT_LABELS: Record<HiringEmployment, string> = {
  pj: "PJ",
  clt: "CLT",
  contractor: "Freelancer",
  intern: "Estágio",
  other: "Outro",
};

/** "8.000,50" ou "8000.5" → número; vazio → undefined. */
function parseMoney(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type Props = {
  open: boolean;
  candidateName: string;
  defaultRoleTitle?: string | null;
  defaultDepartment?: string | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (outcome: HiringOutcome) => void;
};

export function HiringOutcomeDialog({
  open,
  candidateName,
  defaultRoleTitle,
  defaultDepartment,
  submitting = false,
  onCancel,
  onConfirm,
}: Props) {
  const [model, setModel] = useState<HiringModel>("internal");
  const [department, setDepartment] = useState("");
  const [modality, setModality] = useState<HiringModality>("monthly");
  const [employment, setEmployment] = useState<HiringEmployment>("pj");
  const [roleTitle, setRoleTitle] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [monthly, setMonthly] = useState("");
  const [hourly, setHourly] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setModel("internal");
    setDepartment(AREAS.includes(defaultDepartment ?? "") ? (defaultDepartment as string) : "");
    setModality("monthly");
    setEmployment("pj");
    setRoleTitle(defaultRoleTitle ?? "");
    setStartDate(new Date().toISOString().slice(0, 10));
    setMonthly("");
    setHourly("");
    setFee("");
    setNotes("");
  }, [open, defaultRoleTitle, defaultDepartment]);

  const isHunting = model === "hunting";
  const needsMonthly = !isHunting && modality !== "hourly";
  const needsHourly = !isHunting && modality !== "monthly";
  const feeValue = parseMoney(fee);
  const invalid = isHunting ? feeValue === undefined : !department;

  const submit = () => {
    if (invalid) return;
    onConfirm({
      model,
      department: isHunting ? undefined : department,
      modality: isHunting ? undefined : modality,
      employment_type: isHunting ? undefined : modality === "hourly" ? "contractor" : employment,
      role_title: roleTitle.trim() || undefined,
      start_date: startDate ?? undefined,
      monthly_amount: needsMonthly ? parseMoney(monthly) : undefined,
      hourly_rate: needsHourly ? parseMoney(hourly) : undefined,
      fee_amount: isHunting ? feeValue : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onCancel()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar contratação</DialogTitle>
          <DialogDescription>
            {candidateName} vai para Contratado. Os workflows do workspace usam estes dados para
            criar pessoa, contrato e lançamentos.
          </DialogDescription>
        </DialogHeader>

        <FormSection title="Modelo" description="Para quem o profissional vai trabalhar.">
          <div role="radiogroup" aria-label="Modelo de contratação" className="grid gap-2 sm:grid-cols-3">
            {MODELS.map((m) => {
              const Icon = m.icon;
              const active = model === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setModel(m.value)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border-subtle hover:bg-surface-2",
                  )}
                >
                  <Icon
                    className={cn("mt-0.5 h-4 w-4", active ? "text-primary" : "text-text-tertiary")}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm font-medium text-text-primary">{m.label}</span>
                    <span className="block text-xs text-text-secondary">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </FormSection>

        {isHunting ? (
          <FormSection
            title="Honorários"
            description="Vira conta a receber contra a empresa da vaga. Não cria pessoa interna."
          >
            <div className="space-y-1.5">
              <Label htmlFor="hire-fee">Valor do honorário (R$)</Label>
              <Input
                id="hire-fee"
                inputMode="decimal"
                placeholder="Ex.: 12.000,00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                aria-invalid={fee !== "" && feeValue === undefined}
              />
              {fee !== "" && feeValue === undefined ? (
                <p className="text-xs text-destructive">Informe um valor válido.</p>
              ) : null}
            </div>
          </FormSection>
        ) : (
          <>
            <FormSection title="Posição" description="Área, cargo e vínculo do profissional.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hire-area">Área</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger id="hire-area" aria-invalid={!department}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hire-role">Cargo</Label>
                  <Input
                    id="hire-role"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hire-modality">Modalidade</Label>
                  <Select
                    value={modality}
                    onValueChange={(v) => setModality(v as HiringModality)}
                  >
                    <SelectTrigger id="hire-modality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODALITY_LABELS) as HiringModality[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {MODALITY_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {modality !== "hourly" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="hire-employment">Vínculo</Label>
                    <Select
                      value={employment}
                      onValueChange={(v) => setEmployment(v as HiringEmployment)}
                    >
                      <SelectTrigger id="hire-employment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(EMPLOYMENT_LABELS) as HiringEmployment[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {EMPLOYMENT_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </FormSection>

            <FormSection title="Remuneração e início" description="Valores em reais.">
              <div className="grid gap-3 sm:grid-cols-2">
                {needsMonthly ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="hire-monthly">Valor mensal (R$)</Label>
                    <Input
                      id="hire-monthly"
                      inputMode="decimal"
                      placeholder="Ex.: 8.000,00"
                      value={monthly}
                      onChange={(e) => setMonthly(e.target.value)}
                    />
                  </div>
                ) : null}
                {needsHourly ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="hire-hourly">Valor por hora (R$)</Label>
                    <Input
                      id="hire-hourly"
                      inputMode="decimal"
                      placeholder="Ex.: 120,00"
                      value={hourly}
                      onChange={(e) => setHourly(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label>Data de início</Label>
                  <ActivityDateTimePicker
                    dateOnly
                    valueFormat="date"
                    value={startDate}
                    onChange={setStartDate}
                    ariaLabel="Data de início"
                  />
                </div>
              </div>
            </FormSection>
          </>
        )}

        <FormSection title="Observações" description="Opcional.">
          <Textarea
            aria-label="Observações da contratação"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={invalid || submitting}>
            {submitting ? "Registrando…" : "Confirmar contratação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
