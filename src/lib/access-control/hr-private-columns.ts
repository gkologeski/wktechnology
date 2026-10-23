/** Explicit public projections: private columns are read through caller-bound RPCs. */
export const PEOPLE_PUBLIC_COLUMNS =
  "id,owner_id,profile_id,candidate_id,manager_id,full_name,preferred_name,email,phone,photo_url,employment_type,status,role_title,seniority,location,timezone,hire_date,termination_date,legal_entity_name,cnpj,currency,tags,notes,archived,created_by,created_at,updated_at,education,shirt_size,emergency_phone,emergency_relationship,marital_status,spouse_name,trade_name,simples_optante,assigned_to,workspace_id,work_schedule";
export const PEOPLE_ONE_ON_ONES_PUBLIC_COLUMNS =
  "id,owner_id,person_id,manager_id,scheduled_at,held_at,duration_min,status,mood,agenda,notes,action_items,created_by,created_at,updated_at,assigned_to,workspace_id";
export const PEOPLE_ALLOCATIONS_PUBLIC_COLUMNS =
  "id,workspace_id,owner_id,person_id,contract_id,project_id,role_title,allocation_pct,currency,starts_at,ends_at,status,notes,created_at,updated_at,manager_id,assigned_to,purchase_contract_id,competencies,contracting_preset_id,service_id,hours_per_week,hours_per_month,calendar,can_track_time,overbook_justification";
