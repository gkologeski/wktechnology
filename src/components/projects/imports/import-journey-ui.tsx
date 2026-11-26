import type { ReactNode } from "react";
import { Check, Clock3, Fingerprint, Info, Layers3, ShieldCheck } from "lucide-react";
import { TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ImportProvider,
  JourneyRun,
  JourneyRecord,
} from "@/lib/projects/imports/import-journey";
import { count, importIssueLabel } from "./import-format";

export function ProviderIcon({ provider }: { provider: ImportProvider }) {
  const Icon = provider === "clockify" ? Clock3 : provider === "jibble" ? Fingerprint : Layers3;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export function JourneyNotice({
  children,
  warning = false,
  className,
}: {
  children: ReactNode;
  warning?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg bg-primary/5 px-4 py-3 text-sm leading-relaxed text-text-secondary",
        warning && "bg-warning/8",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function ImportSafetyNote() {
  return (
    <p className="flex max-w-3xl items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      Importar não aprova horas, não libera pagamentos e não gera faturamento. Vínculos, erros e
      divergências permanecem disponíveis para conferência.
    </p>
  );
}

export function RunBadge({ run }: { run: JourneyRun }) {
  if (run.sourceLimited && !run.resumable && run.status !== "running")
    return <Badge variant="outline">Limitações da origem</Badge>;
  if (run.status === "running") return <Badge variant="outline">Em andamento</Badge>;
  if (run.status === "paused") return <Badge variant="outline">Pausado</Badge>;
  if (run.status === "failed") return <Badge variant="destructive">Interrompido</Badge>;
  if (run.status === "partial" || !run.coverageComplete)
    return <Badge variant="outline">Coleta incompleta</Badge>;
  return <Badge variant="secondary">Cobertura completa</Badge>;
}

export function JourneySteps({ step }: { step: number }) {
  return (
    <ol aria-label="Etapas da importação" className="mb-9 flex w-full items-start gap-2 sm:gap-4">
      {["Origens", "Conferir cobertura", "Importar tudo", "Revisar resultado"].map((label, i) => (
        <li
          key={label}
          aria-current={step === i + 1 ? "step" : undefined}
          className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center text-xs sm:flex-row sm:text-left"
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground",
              step === i + 1 && "bg-primary text-primary-foreground",
              step > i + 1 && "bg-primary/10 text-primary",
            )}
          >
            {step > i + 1 ? <Check className="size-3" aria-hidden /> : i + 1}
          </span>
          <span
            className={cn(
              "max-w-24 leading-relaxed text-muted-foreground sm:max-w-none",
              step === i + 1 && "font-medium text-foreground",
            )}
          >
            {label}
          </span>
          {i < 3 && (
            <span
              className="absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-3 h-px bg-border-subtle sm:static sm:mx-1 sm:flex-1"
              aria-hidden
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export function RecordBadge({
  record,
  issuesOnly = false,
}: {
  record: JourneyRecord;
  issuesOnly?: boolean;
}) {
  return (
    <Badge
      variant={record.status === "ready" ? "secondary" : "outline"}
      className="max-w-60 whitespace-normal text-left"
    >
      {record.status === "pending"
        ? issuesOnly && record.issues.length
          ? importIssueLabel(record.issues[0])
          : "Com pendência"
        : record.status === "ready"
          ? "Pronto para uso"
          : "Recebido · a classificar"}
      {issuesOnly && record.issues.length > 1 ? ` +${record.issues.length - 1}` : ""}
    </Badge>
  );
}

export function JourneyTab({
  value,
  children,
}: {
  value: "import" | "records" | "issues" | "history";
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-auto gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-1 text-xs font-normal shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:shadow-none"
    >
      {children}
    </TabsTrigger>
  );
}
export function TabCount({ value }: { value: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
      {count(value)}
    </span>
  );
}
