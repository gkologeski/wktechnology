export type HiringAccessModel = {
  id: string;
  name: string;
  role_id: string | null;
  revision: number;
  permission_keys: string[];
  allocation_only: boolean;
  active: boolean;
};
export type HiringModelContext = {
  entities: { id: string; name: string }[];
  models: HiringAccessModel[];
  roles: { id: string; name: string }[];
  permissions: { key: string; label: string }[];
};
export type HiringEngagement = {
  id: string;
  person_id: string;
  person_name: string;
  application_id: string;
  job_id: string;
  purpose: string;
  employment_type: string;
  legal_entity_id: string;
  commercial_contract_id: string | null;
  purchase_contract_id: string | null;
  model_name: string;
  allocation_only: boolean;
  starts_at: string;
  ends_at: string | null;
  status: string;
  revision: number;
  invite_pending: boolean;
  access_active: boolean;
};
export type HiringEmploymentContext = {
  engagements: HiringEngagement[];
  models: { id: string; name: string }[];
  entities: { id: string; name: string }[];
  people: { id: string; name: string }[];
  applications: {
    id: string;
    title: string;
    job_id: string;
    status: string;
    purpose: string | null;
    employment: string;
    hire_date: string | null;
    entity_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
    reason: string | null;
  }[];
  contracts: { id: string; title: string }[];
  projects: { id: string; name: string }[];
};
