import { ScorecardEvalDialog } from "@/components/ats/scorecard-eval-dialog";
import type { App } from "@/components/ats/jobs/job-detail.types";

/* Eval dialog mount point (kept for parity) */
export function JobEvalDialog({
  evalApp,
  jobId,
  onClose,
  refresh,
}: {
  evalApp: App | null;
  jobId: string;
  onClose: () => void;
  refresh: () => void;
}) {
  if (!evalApp) return null;
  return (
    <ScorecardEvalDialog
      open={!!evalApp}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      applicationId={evalApp.id}
      jobId={jobId}
      candidateId={evalApp.candidate_id}
      candidateName={evalApp.candidate?.full_name ?? "Candidato"}
      onSaved={refresh}
    />
  );
}
