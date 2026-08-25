import { cn } from "@/lib/utils";
import {
  DERIVED_STATUS_LABELS,
  type DerivedCandidateStatus,
} from "@/lib/ats/candidate-status.functions";

export const STATUS_ORDER: DerivedCandidateStatus[] = [
  "new",
  "in_process",
  "interview",
  "offer",
  "hired",
  "archived",
];

export const STATUS_CLS: Record<DerivedCandidateStatus, string> = {
  new: "border-border-subtle bg-surface-sunken text-text-secondary",
  in_process: "border-stage-screen/30 bg-stage-screen/10 text-stage-screen",
  interview: "border-stage-interview/30 bg-stage-interview/10 text-stage-interview",
  offer: "border-stage-offer/30 bg-stage-offer/10 text-stage-offer",
  hired: "border-stage-hired/30 bg-stage-hired/10 text-stage-hired",
  archived: "border-stage-rejected/30 bg-stage-rejected/10 text-stage-rejected",
};

export function CandidateStatusPill({ status }: { status: DerivedCandidateStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        STATUS_CLS[status],
      )}
    >
      {DERIVED_STATUS_LABELS[status]}
    </span>
  );
}
