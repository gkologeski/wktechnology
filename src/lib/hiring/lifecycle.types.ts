export type LifecycleKind = "renew" | "replace" | "end_allocation" | "end_employment";
export type LifecycleInput = {
  engagementId: string;
  allocationId: string | null;
  kind: LifecycleKind;
  effectiveDate: string;
  startsAt: string | null;
  endsAt: string | null;
  replacementId: string | null;
  overlap: boolean;
  reason: string;
};
export type LifecyclePreview = {
  hash: string;
  revision: number;
  policy_revision: number;
  manager: string;
  ceo: string;
  financial_review: string;
};
export type LifecycleContext = {
  enabled: boolean;
  actor_id: string;
  allocations: {
    id: string;
    engagement_id: string;
    project_name: string;
    starts_at: string;
    ends_at: string | null;
  }[];
  replacements: { id: string; name: string; starts_at: string; ends_at: string | null }[];
  requests: {
    id: string;
    kind: LifecycleKind;
    status: string;
    effective_date: string;
    reason: string;
    revision: number;
    requested_by: string;
    next_approver: string | null;
    steps: { stage: string; status: string; approver_id: string; note: string | null }[];
  }[];
};
