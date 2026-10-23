-- Contenção opcional em incidente. Não é aplicada automaticamente.
-- Desabilita temporariamente as duas RPCs de usuário sem reabrir acesso anônimo.
-- Helpers/gatilhos internos continuam funcionando. Não apaga dados ou migrações.
BEGIN;
REVOKE ALL ON FUNCTION public.get_entity_field_catalog(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.anonymize_ats_candidate(uuid) FROM PUBLIC,anon,authenticated;
DO $api$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_api_subject') THEN
    REVOKE ALL ON FUNCTION public.get_entity_field_catalog(text,uuid),
      public.anonymize_ats_candidate(uuid) FROM techerp_api_subject;
  END IF;
END $api$;
COMMIT;
