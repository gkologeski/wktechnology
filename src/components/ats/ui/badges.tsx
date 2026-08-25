import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeBaseProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
};

function BadgeBase({
  children,
  className,
  icon,
  ...rest
}: BadgeBaseProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[11px] font-medium leading-none whitespace-nowrap",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

/* ----- StatusBadge: job status ----- */
export type JobStatus = "open" | "onhold" | "closed" | "draft";
const statusMap: Record<JobStatus, { label: string; cls: string }> = {
  open: {
    label: "Aberta",
    cls: "border-status-open/30 bg-status-open/10 text-status-open",
  },
  onhold: {
    label: "Em pausa",
    cls: "border-status-onhold/30 bg-status-onhold/10 text-status-onhold",
  },
  closed: {
    label: "Fechada",
    cls: "border-status-closed/30 bg-status-closed/10 text-status-closed",
  },
  draft: {
    label: "Rascunho",
    cls: "border-border-default bg-surface-sunken text-text-secondary",
  },
};
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: JobStatus;
  label?: string;
  className?: string;
}) {
  const cfg = statusMap[status];
  return <BadgeBase className={cn(cfg.cls, className)}>{label ?? cfg.label}</BadgeBase>;
}

/* ----- StageBadge: pipeline stage ----- */
export type PipelineStage = "sourced" | "screen" | "interview" | "offer" | "hired" | "rejected";
const stageMap: Record<PipelineStage, { label: string; cls: string }> = {
  sourced: {
    label: "Sourced",
    cls: "border-stage-sourced/30 bg-stage-sourced/10 text-stage-sourced",
  },
  screen: { label: "Triagem", cls: "border-stage-screen/30 bg-stage-screen/10 text-stage-screen" },
  interview: {
    label: "Entrevista",
    cls: "border-stage-interview/30 bg-stage-interview/10 text-stage-interview",
  },
  offer: { label: "Oferta", cls: "border-stage-offer/30 bg-stage-offer/10 text-stage-offer" },
  hired: { label: "Contratado", cls: "border-stage-hired/30 bg-stage-hired/10 text-stage-hired" },
  rejected: {
    label: "Rejeitado",
    cls: "border-stage-rejected/30 bg-stage-rejected/10 text-stage-rejected",
  },
};
export function StageBadge({
  stage,
  label,
  className,
}: {
  stage: PipelineStage;
  label?: string;
  className?: string;
}) {
  const cfg = stageMap[stage];
  return <BadgeBase className={cn(cfg.cls, className)}>{label ?? cfg.label}</BadgeBase>;
}

/* ----- ScoreBadge: candidate / match score (0..100) ----- */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const cls =
    score >= 80
      ? "border-score-strong/30 bg-score-strong/10 text-score-strong"
      : score >= 60
        ? "border-score-good/30 bg-score-good/10 text-score-good"
        : score >= 40
          ? "border-score-mixed/30 bg-score-mixed/10 text-score-mixed"
          : "border-score-weak/30 bg-score-weak/10 text-score-weak";
  return <BadgeBase className={cn("tabular-nums", cls, className)}>{Math.round(score)}</BadgeBase>;
}

/* ----- SourceBadge: candidate source ----- */
export function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <BadgeBase
      className={cn(
        "border-border-subtle bg-surface-sunken text-text-secondary capitalize",
        className,
      )}
    >
      {source}
    </BadgeBase>
  );
}

/* ----- RiskBadge: fraud / risk ----- */
export type RiskLevel = "low" | "medium" | "high";
const riskMap: Record<RiskLevel, { label: string; cls: string }> = {
  low: { label: "Risco baixo", cls: "border-risk-low/30 bg-risk-low/10 text-risk-low" },
  medium: { label: "Risco médio", cls: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium" },
  high: { label: "Risco alto", cls: "border-risk-high/30 bg-risk-high/10 text-risk-high" },
};
export function RiskBadge({
  level,
  label,
  className,
}: {
  level: RiskLevel;
  label?: string;
  className?: string;
}) {
  const cfg = riskMap[level];
  return <BadgeBase className={cn(cfg.cls, className)}>{label ?? cfg.label}</BadgeBase>;
}
