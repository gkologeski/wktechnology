export type ContractDashboardItem = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  totalValue: number;
  endsAt: string | null;
  autoRenew: boolean;
};

export type ContractDashboardData = {
  activeCount: number;
  activeValue: number;
  awaitingCount: number;
  expiringCount: number;
  statusCounts: Array<{ status: string; count: number }>;
  expiring: ContractDashboardItem[];
  attention: ContractDashboardItem[];
  recent: ContractDashboardItem[];
};
