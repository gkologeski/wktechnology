// Formatos devolvidos pelas funções do banco do ciclo 3 (apontamento, cronômetro, aprovação).

export type TimePolicy = {
  version: number;
  saved_at: string | null;
  allow_self_approval: boolean;
  track_requires_link: boolean;
  duration_entries_allowed: boolean;
  max_daily_seconds: number;
  allocation_max_pct: number;
  paid_break_counts_as_productive: boolean;
  paid_break_counts_as_presence: boolean;
  submit_blocks_on_overlap: boolean;
  submit_requires_approver: boolean;
  closing_requires_client_acceptance: boolean;
};

export type TrackableProject = {
  id: string;
  name: string;
  status: string;
  favorite: boolean;
  last_used: string | null;
  billable_default: boolean;
};

export type TrackableProjects = {
  policy: TimePolicy;
  projects: TrackableProject[];
  person_linked: boolean;
};

export type TimerSegment = {
  kind: "work" | "break_paid" | "break_unpaid";
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
};

export type TimerState = {
  id: string;
  state: "running" | "paused" | "stopped" | "discarded";
  version: number;
  project_id: string;
  project_name: string | null;
  task_id: string | null;
  task_title: string | null;
  description: string | null;
  billable: boolean;
  timezone: string;
  started_at: string;
  stopped_at: string | null;
  server_now: string;
  work_seconds: number;
  paid_break_seconds: number;
  unpaid_break_seconds: number;
  segments: TimerSegment[];
  entries: {
    id: string;
    entry_date: string;
    duration_seconds: number;
    review_flags: string[] | null;
  }[];
  conflict?: boolean;
  idempotent?: boolean;
};

export type PreviewIssue = { code: string; message: string; n: number; project_id?: string | null };

export type SubmissionPreview = {
  entries: {
    id: string;
    revision: number;
    project_id: string;
    project_name: string;
    task_title: string | null;
    entry_date: string;
    seconds: number;
    review_flags: string[] | null;
  }[];
  hash: string;
  entry_count: number;
  total_seconds: number;
  blockers: PreviewIssue[];
  warnings: PreviewIssue[];
  policy_version: number;
};

export type PendingItem = {
  item_id: string;
  submission_id: string;
  entry_id: string;
  revision: number;
  user_id: string;
  user_name: string;
  project_id: string;
  project_name: string;
  task_title: string | null;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  started_at: string | null;
  stopped_at: string | null;
  timezone: string | null;
  entry_kind: string | null;
  seconds: number;
  description: string | null;
  billable: boolean;
  review_flags: string[] | null;
  submitted_at: string;
  submission_version: number;
};

export type PendingApprovals = { total: number; total_seconds: number; items: PendingItem[] };

export type OverviewBucket = {
  registered: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  locked_import: number;
};

export type TimesheetOverview = {
  totals: OverviewBucket & { closed: number; entries: number };
  by_user: (OverviewBucket & { user_id: string; name: string; schedule_configured: boolean })[];
  by_day: { date: string; registered: number; approved: number }[];
  by_project: { project_id: string; name: string | null; registered: number }[];
};

export type ApproverRow = {
  id: string;
  project_id: string;
  role: "approver" | "operational_manager";
  user_id: string;
  subject_user_id: string | null;
  delegate_of: string | null;
  valid_from: string;
  valid_to: string | null;
  reason: string | null;
  revoked_at: string | null;
};

export type ClosePreview = {
  pending: number;
  pending_seconds: number;
  eligible: number;
  eligible_seconds: number;
  already_closed: number;
  missing_acceptance: number;
  imported_locked: number;
  imported_locked_seconds: number;
  running_timers: number;
  overlapping_closing: boolean;
  acceptance_required: boolean;
  policy_version: number;
};

export type JibbleHourRow = {
  staging_id: string;
  external_id: string;
  person_external_id: string;
  user_id: string | null;
  user_name: string | null;
  project_external_id: string | null;
  project_id: string | null;
  project_name: string | null;
  entry_date: string | null;
  seconds: number;
  day_hour_seconds: number;
  day_interval_seconds: number;
  day_erp_seconds: number;
  note: string | null;
  classification: string;
};

export type JibbleHourPreview = {
  summary: Record<string, { count: number; seconds: number }>;
  total: number;
  rows: JibbleHourRow[];
};

export const JIBBLE_HOUR_CLASS_LABEL: Record<string, string> = {
  candidate: "Pode virar apontamento (sem cobertura no dia)",
  covered: "Coberto por intervalos do Jibble",
  partial_coverage: "Cobertura parcial: revisão",
  other_entries_same_day: "Há apontamentos de outra fonte no dia: revisão",
  no_person: "Pessoa sem mapeamento",
  no_project: "Sem projeto na origem",
  project_unmapped: "Projeto sem mapeamento",
  materialized: "Já virou apontamento",
  archived: "Arquivado na origem",
  invalid: "Duração ou data inválida",
};
