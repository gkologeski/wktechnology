CREATE OR REPLACE FUNCTION public.wa_outbound_register_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c record; author uuid; origin text; subj text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'outbound' OR NEW.wa_message_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, workspace_id, contact_id, assigned_to INTO c FROM whatsapp_conversations WHERE id=NEW.conversation_id;
  IF c.contact_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM activities a WHERE a.workspace_id=c.workspace_id AND a.type='whatsapp' AND a.external_ids->>'wa_message_id'=NEW.wa_message_id) THEN RETURN NEW; END IF;
  author := CASE WHEN EXISTS(SELECT 1 FROM workspace_members w WHERE w.workspace_id=c.workspace_id AND w.user_id=NEW.sent_by AND w.status='active') THEN NEW.sent_by
                 WHEN EXISTS(SELECT 1 FROM workspace_members w WHERE w.workspace_id=c.workspace_id AND w.user_id=c.assigned_to AND w.status='active') THEN c.assigned_to END;
  origin := CASE WHEN NEW.raw ? 'sdr' THEN 'agent' WHEN NEW.is_template AND NEW.sent_by IS DISTINCT FROM auth.uid() THEN 'campaign' ELSE 'inbox' END;
  subj := CASE origin WHEN 'agent' THEN 'WhatsApp · Agente' WHEN 'campaign' THEN 'WhatsApp · Campanha' || coalesce(' · '||NEW.template_name,'') ELSE coalesce('WhatsApp · '||NEW.template_name,'WhatsApp enviado') END;
  BEGIN
    INSERT INTO activities(workspace_id, owner_id, assigned_to, created_by, type, related_contact_id, subject, body, email_direction, completed, outcome, outcome_set_at, external_ids)
    VALUES (c.workspace_id, author, author, author, 'whatsapp', c.contact_id, subj,
      coalesce(nullif(NEW.body,''), CASE WHEN NEW.template_name IS NOT NULL THEN '[modelo '||NEW.template_name||']' WHEN NEW.media_url IS NOT NULL THEN '[mídia]' ELSE '' END),
      'outbound', true, 'sent', coalesce(NEW.sent_at, now()),
      jsonb_build_object('wa_message_id',NEW.wa_message_id,'conversation_id',c.id,'origin',origin));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'wa_outbound_register_activity: %', SQLSTATE;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wa_outbound_register_activity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wa_outbound_register_activity AFTER INSERT ON public.whatsapp_messages FOR EACH ROW EXECUTE FUNCTION public.wa_outbound_register_activity();