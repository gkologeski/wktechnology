CREATE OR REPLACE FUNCTION public.contract_draft_public_get(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'title', d.title,
    'body_html', d.body_html,
    'status', d.status,
    'workspace_name', w.name,
    'client_decided_at', d.client_decided_at,
    'client_name', d.client_name,
    'proposal_public_token', p.public_token
  )
  FROM public.contract_drafts d
  JOIN public.workspaces w ON w.id = d.workspace_id
  LEFT JOIN public.proposals p
    ON p.id = d.proposal_id
   AND p.workspace_id = d.workspace_id
   AND p.status IN ('sent', 'accepted', 'rejected')
   AND p.locked = true
   AND p.sent_at IS NOT NULL
   AND p.public_token IS NOT NULL
  WHERE d.public_token = p_token
    AND d.status IN ('sent', 'accepted', 'changes_requested');
$$;

REVOKE ALL ON FUNCTION public.contract_draft_public_get(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_draft_public_get(uuid) TO service_role;