\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SELECT set_config('request.jwt.claims','{}',false);
-- Match the live catalog's enum types; a text-only fixture hid a real INSERT
-- SELECT incompatibility. No production schema is changed by this fixture.
CREATE TYPE public.perm_action AS ENUM('view','create','update','delete','export','approve','assign','manage');
CREATE TYPE public.perm_scope AS ENUM('own','team','workspace','org');
ALTER TABLE public.permissions ALTER COLUMN action TYPE public.perm_action USING action::public.perm_action,
  ALTER COLUMN scope TYPE public.perm_scope USING scope::public.perm_scope;
ALTER TABLE people ADD COLUMN cost_hour numeric,ADD COLUMN monthly_cost numeric,ADD COLUMN personal_doc jsonb DEFAULT '{}',ADD COLUMN bank text,ADD COLUMN bank_agency text,ADD COLUMN bank_account text,ADD COLUMN pix_key text,ADD COLUMN address text;
ALTER TABLE people_one_on_ones ADD COLUMN private_notes text;
ALTER TABLE people_allocations ADD COLUMN billable_rate numeric,ADD COLUMN cost_rate numeric;
UPDATE people SET bank='SYNTHETIC BANK',monthly_cost=1234 WHERE id='95600000-0000-4000-8000-000000000001';
UPDATE people_one_on_ones SET private_notes='SYNTHETIC NOTE' WHERE id='95700000-0000-4000-8000-000000050001';
UPDATE people_allocations SET billable_rate=99,cost_rate=55 WHERE id='95700000-0000-4000-8000-000000030001';
