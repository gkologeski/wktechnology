-- Remove inherited Supabase table defaults; retain only the reviewed metadata columns.
REVOKE ALL ON TABLE public.inbox_channel_occurrences FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,workspace_id,channel,account_id,conversation_id,event_key,message_id,inbound_id,actor_id,assigned_to,previous_status,status,occurred_at) ON TABLE public.inbox_channel_occurrences TO authenticated;
NOTIFY pgrst,'reload schema';
