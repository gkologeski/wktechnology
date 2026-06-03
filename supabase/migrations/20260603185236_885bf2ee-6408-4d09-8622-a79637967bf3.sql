-- Allow workspace peers to read profiles of users they share a workspace with
CREATE POLICY profiles_workspace_peers_select ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.shares_workspace_with(id));

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;

-- Realtime channel authorization: scope subscriptions to workspace members / chat members
-- Topic conventions used in app: "workspace:<workspace_id>:*" and "chat:<conversation_id>"
CREATE POLICY realtime_authenticated_read ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- workspace-scoped topics
  (
    realtime.topic() LIKE 'workspace:%'
    AND public.is_workspace_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
  OR
  -- chat conversation topics
  (
    realtime.topic() LIKE 'chat:%'
    AND public.is_chat_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
  OR
  -- user-private topics: "user:<uid>"
  (
    realtime.topic() LIKE 'user:%'
    AND NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
  )
);

CREATE POLICY realtime_authenticated_send ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'workspace:%'
    AND public.is_workspace_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
  OR
  (
    realtime.topic() LIKE 'chat:%'
    AND public.is_chat_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
  OR
  (
    realtime.topic() LIKE 'user:%'
    AND NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
  )
);