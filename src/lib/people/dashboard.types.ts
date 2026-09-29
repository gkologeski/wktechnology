export type PeopleDashboardData = {
  headcount: number;
  activeAllocations: number;
  allocationRate: number;
  marginPct: number | null;
  canViewFinancials: boolean;
  employment: Array<{ type: string; count: number }>;
  expiringDocuments: number;
  activeOnboarding: number;
  activeOffboarding: number;
  overduePlans: number;
};
