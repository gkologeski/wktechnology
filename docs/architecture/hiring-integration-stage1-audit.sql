-- Auditoria sem escrita. Uso com psql:
-- psql "$DATABASE_URL" -v workspace_id='<uuid do workspace autorizado>' -f este-arquivo.sql
-- Credenciais ficam no ambiente seguro, nunca no arquivo. Resultados são internos.
-- A ausência da variável workspace_id impede a execução; não há fallback global.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT :'workspace_id'::uuid AS audited_workspace,
       current_timestamp AS captured_at;

WITH scope AS (SELECT :'workspace_id'::uuid AS ws)
SELECT 'profiles' AS entity, count(*) AS total,
       count(*) FILTER (WHERE ats_job_id IS NOT NULL) AS linked,
       'ats_job_id' AS link_field
FROM deal_role_profiles, scope WHERE workspace_id = ws
UNION ALL
SELECT 'ats_jobs', count(*), count(*) FILTER (WHERE deal_id IS NOT NULL), 'deal_id'
FROM ats_jobs, scope WHERE workspace_id = ws
UNION ALL
SELECT 'contracts', count(*), count(*) FILTER (WHERE contracting_legal_entity_id IS NOT NULL), 'contracting_legal_entity_id'
FROM contracts, scope WHERE workspace_id = ws
UNION ALL
SELECT 'projects', count(*), count(*) FILTER (WHERE deal_id IS NOT NULL), 'deal_id'
FROM projects, scope WHERE workspace_id = ws
UNION ALL
SELECT 'project_deal_links', count(*), count(*), 'secondary_link'
FROM project_deal_links, scope WHERE workspace_id = ws
UNION ALL
SELECT 'project_contracts', count(*), count(*) FILTER (WHERE contract_id IS NOT NULL), 'contract_id'
FROM projects, scope WHERE workspace_id = ws
UNION ALL
SELECT 'people_allocations', count(*), count(*) FILTER (WHERE status = 'active'), 'active_status'
FROM people_allocations, scope WHERE workspace_id = ws
UNION ALL
SELECT 'time_person', count(*), count(*) FILTER (WHERE person_id IS NOT NULL), 'person_id'
FROM project_time_entries, scope WHERE workspace_id = ws
UNION ALL
SELECT 'time_allocation', count(*), count(*) FILTER (WHERE allocation_id IS NOT NULL), 'allocation_id'
FROM project_time_entries, scope WHERE workspace_id = ws
UNION ALL
SELECT 'billing_configs', count(*), NULL::bigint, 'not_applicable'
FROM project_billing_configs, scope WHERE workspace_id = ws
UNION ALL
SELECT 'measurements', count(*), count(*) FILTER (WHERE financial_entry_id IS NOT NULL), 'financial_entry_id'
FROM project_measurements, scope WHERE workspace_id = ws;

SELECT name, active, category, service_type, billing_model, unit, default_cadence
FROM service_catalog
WHERE workspace_id = :'workspace_id'::uuid
ORDER BY name;

SELECT enabled, origins,
       project_creator_id IS NOT NULL AS creator_defined,
       default_operational_owner_id IS NOT NULL AS operational_owner_defined
FROM deal_delivery_policies
WHERE workspace_id = :'workspace_id'::uuid;

SELECT status, count(*) AS count
FROM project_link_suggestions
WHERE workspace_id = :'workspace_id'::uuid
GROUP BY status ORDER BY status;

SELECT status, count(*) AS count
FROM project_reconciliation_issues
WHERE workspace_id = :'workspace_id'::uuid
GROUP BY status ORDER BY status;

COMMIT;
