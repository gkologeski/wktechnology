\set ON_ERROR_STOP on
BEGIN;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated only';END IF;END$$;
CREATE SCHEMA techerp_api;
REVOKE ALL ON SCHEMA techerp_api FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA techerp_api TO techerp_api_subject;
GRANT USAGE ON SCHEMA techerp_api TO service_role;
CREATE TABLE techerp_api.subject_sessions(txid bigint PRIMARY KEY,user_id uuid NOT NULL,workspace_id uuid NOT NULL,api_key_id uuid NOT NULL,prev_claims text,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON techerp_api.subject_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON techerp_api.subject_sessions TO techerp_api_subject;
GRANT authenticated TO techerp_api_subject;
GRANT techerp_api_subject TO postgres;
GRANT SELECT(id,owner_id,workspace_id,scopes,revoked_at,expires_at) ON public.api_keys TO techerp_api_subject;
CREATE OR REPLACE FUNCTION techerp_api.enter(p_key uuid, p_user uuid, p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_prev text := current_setting('request.jwt.claims', true);
BEGIN
  IF p_key IS NULL OR p_user IS NULL OR p_ws IS NULL THEN RAISE EXCEPTION 'API_SUBJECT_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF current_setting('app.api_subject', true) = 'on' THEN RAISE EXCEPTION 'API_SUBJECT_NESTED' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aud', 'authenticated', 'api_key_id', p_key)::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  INSERT INTO techerp_api.subject_sessions (txid, user_id, workspace_id, api_key_id, prev_claims)
  VALUES (txid_current(), p_user, p_ws, p_key, v_prev);
  PERFORM set_config('app.api_subject', 'on', true);
  IF NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = p_key AND k.owner_id = p_user AND k.workspace_id = p_ws
                    AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > now())) THEN
    RAISE EXCEPTION 'API_KEY_INVALID' USING ERRCODE = '28000';
  END IF;
  IF NOT (p_ws IN (SELECT public.current_user_workspaces())) THEN
    RAISE EXCEPTION 'API_SUBJECT_INACTIVE: o dono da chave não é membro ativo do workspace.' USING ERRCODE = '42501';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.leave()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_prev text;
BEGIN
  DELETE FROM techerp_api.subject_sessions WHERE txid = txid_current() RETURNING prev_claims INTO v_prev;
  PERFORM set_config('app.api_subject', 'off', true);
  PERFORM set_config('request.jwt.claims', coalesce(v_prev, ''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_prev::jsonb->>'sub', ''), true);
  PERFORM set_config('request.jwt.claim.role', coalesce(v_prev::jsonb->>'role', ''), true);
END $function$;

ALTER FUNCTION techerp_api.enter(uuid,uuid,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.enter(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION techerp_api.enter(uuid,uuid,uuid) TO techerp_api_subject;

ALTER FUNCTION techerp_api.leave() OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.leave() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION techerp_api.leave() TO techerp_api_subject;

COMMIT;
