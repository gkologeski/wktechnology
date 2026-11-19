-- Preparation validates project provenance under a NOLOGIN, non-BYPASSRLS owner.
-- The existing authenticated grants omit this one column; do not grant a table
-- read or change caller RLS, business permissions, existing projects or entities.
GRANT SELECT (legal_entity_id) ON TABLE public.projects TO techerp_request_writer;
-- The commercial-origin validator also reads the historical fallback column.
GRANT SELECT (legal_entity_id) ON TABLE public.contracts TO techerp_request_writer;
