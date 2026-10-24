\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SELECT set_config('request.jwt.claims','{}',false);
ALTER TABLE ats_pipelines ADD COLUMN owner_id uuid, ADD COLUMN name text DEFAULT 'Synthetic', ADD COLUMN is_default boolean NOT NULL DEFAULT false, ADD COLUMN stages jsonb DEFAULT '[]', ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE ats_pipelines ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE ats_pipelines SET owner_id='90000000-0000-4000-8000-000000000003';
INSERT INTO ats_pipelines(id,workspace_id,owner_id,name) VALUES
 ('97000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','Own'),
 ('97000000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','Other');
ALTER TABLE ats_pipelines ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_pipelines TO authenticated;
CREATE POLICY old_workspace_all ON ats_pipelines TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_upd ON ats_pipelines AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON ats_pipelines AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON ats_pipelines AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
-- Existing production catalog and WK Head grants, not migration grants.
INSERT INTO permissions(key,module,resource,action,scope,label_pt)
SELECT 'techhire.pipelines.'||a||'.'||s,'techhire','pipelines',a::perm_action,s::perm_scope,'Synthetic pipeline '||a||' '||s
FROM(VALUES('view','own'),('view','team'),('view','workspace'),('create','own'),('create','workspace'),('update','own'),('update','team'),('update','workspace'),('delete','own'),('delete','workspace'),('export','workspace'))k(a,s) ON CONFLICT(key) DO NOTHING;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.pipelines.%' ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
CREATE OR REPLACE FUNCTION ats_pipelines_enforce_single_default() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.is_default THEN UPDATE ats_pipelines SET is_default=false,updated_at=now() WHERE id<>NEW.id AND is_default AND workspace_id=NEW.workspace_id; END IF;RETURN NEW; END $$;
CREATE TRIGGER trg_ats_pipelines_single_default AFTER INSERT OR UPDATE OF is_default,owner_id ON ats_pipelines FOR EACH ROW WHEN(NEW.is_default) EXECUTE FUNCTION ats_pipelines_enforce_single_default();
