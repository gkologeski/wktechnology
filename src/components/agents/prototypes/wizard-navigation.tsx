import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
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
import { useDemo } from "./state";
import { STEPS, validateStep } from "./model";

export function StepRail() {
  const { step, setStep, agent } = useDemo();
  return (
    <aside className="ap-steprail">
      <p className="ap-step-subtitle mb-5 px-3 text-[10px] font-semibold uppercase text-muted-foreground">
        Construção do agente
      </p>
      <ol>
        {STEPS.map((label, i) => (
          <li key={label}>
            <Button
              variant="ghost"
              className={`mb-2 w-full justify-start gap-3 px-3 text-xs ${step === i ? "bg-accent text-primary" : ""}`}
              onClick={() => {
                if (i > step) {
                  const error = Array.from({ length: i }, (_, n) => validateStep(agent, n)).find(
                    Boolean,
                  );
                  if (error) {
                    toast.error(error);
                    return;
                  }
                }
                setStep(i);
              }}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] ${step === i ? "bg-primary text-primary-foreground" : "bg-product-panel-strong text-muted-foreground"}`}
              >
                {i < step ? <Check size={12} /> : String(i + 1).padStart(2, "0")}
              </span>
              {label}
            </Button>
          </li>
        ))}
      </ol>
      <div className="ap-step-subtitle mt-8 border-t border-border-subtle px-3 pt-4 text-xs text-muted-foreground">
        <ShieldCheck size={16} className="mb-2" />
        Rascunho independente
        <br />
        Nenhum canal será ativado.
      </div>
    </aside>
  );
}

export function WizardFooter() {
  const { step, setStep, agent, go, save } = useDemo();
  return (
    <footer className="ap-wizard-footer">
      <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : go("list"))}>
        <ArrowLeft />
        Voltar
      </Button>
      <span className="ap-caption">{step + 1} / 8</span>
      <Button
        onClick={() => {
          const error = validateStep(agent, step);
          if (error) {
            toast.error(error);
            return;
          }
          if (step < 7) setStep(step + 1);
          else {
            save();
            go("studio");
          }
        }}
      >
        {step === 7 ? "Concluir rascunho" : "Continuar"}
        <ArrowRight />
      </Button>
    </footer>
  );
}

export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {multiline ? (
        <Textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem value={o} key={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
