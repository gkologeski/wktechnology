DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.notify_assigned_inbox_message'::regproc);
  d := replace(d, $q$v_link := '/inbox/whatsapp';$q$, $q$v_link := '/inbox/whatsapp?conversation=' || NEW.conversation_id::text;$q$);
  IF position('?conversation=' in d) = 0 THEN RAISE EXCEPTION 'link não substituído'; END IF;
  EXECUTE d;
END
$mig$;