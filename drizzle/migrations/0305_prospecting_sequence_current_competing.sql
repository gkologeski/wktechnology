-- Recheck exclusions when legacy/SDR enrollment starts after the snapshot. No new grants.
CREATE OR REPLACE FUNCTION public.prospecting_sequence_commercial_block(p_run uuid,p_source jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;definition jsonb;customer boolean;open_deal boolean;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT v.definition INTO definition FROM public.prospecting_sequence_versions v WHERE v.id=r.version_id AND v.workspace_id=r.workspace_id;
 IF p.id IS NULL OR definition IS NULL THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 WITH related_leads AS(
  SELECT l.id,l.company_id,l.converted_contact_id FROM public.leads l WHERE l.workspace_id=r.workspace_id AND l.deleted_at IS NULL AND (p.entity='lead' AND l.id=p.source_id OR lower(btrim(l.email))=lower(btrim(p_source->>'email')) OR EXISTS(SELECT 1 FROM unnest(ARRAY[l.whatsapp_e164,l.mobile_phone,l.phone]) n WHERE nullif(regexp_replace(n,'\D','','g'),'') IN(SELECT regexp_replace(v,'\D','','g') FROM jsonb_array_elements_text(p_source->'phones') v)))
 ),related_contacts AS(
  SELECT c.id,c.company_id FROM public.contacts c WHERE c.workspace_id=r.workspace_id AND c.deleted_at IS NULL AND (p.entity='contact' AND c.id=p.source_id OR c.id IN(SELECT converted_contact_id FROM related_leads) OR lower(btrim(c.email))=lower(btrim(p_source->>'email')) OR EXISTS(SELECT 1 FROM unnest(ARRAY[c.whatsapp_e164,c.mobile_phone,c.phone]) n WHERE nullif(regexp_replace(n,'\D','','g'),'') IN(SELECT regexp_replace(v,'\D','','g') FROM jsonb_array_elements_text(p_source->'phones') v)))
 ),companies AS(SELECT company_id id FROM related_contacts UNION SELECT company_id FROM related_leads),deals AS(
  SELECT d.stage FROM public.deals d WHERE d.workspace_id=r.workspace_id AND d.deleted_at IS NULL AND (d.company_id IN(SELECT id FROM companies) OR d.primary_contact_id IN(SELECT id FROM related_contacts) OR d.lead_id IN(SELECT id FROM related_leads) OR EXISTS(SELECT 1 FROM public.deal_contacts dc WHERE dc.deal_id=d.id AND dc.contact_id IN(SELECT id FROM related_contacts)))
 ) SELECT EXISTS(SELECT 1 FROM deals WHERE lower(coalesce(stage::text,'')) IN('won','closedwon','ganho')) OR EXISTS(SELECT 1 FROM public.contracts co WHERE co.workspace_id=r.workspace_id AND co.status='active' AND co.counterparty_company_id IN(SELECT id FROM companies)),EXISTS(SELECT 1 FROM deals WHERE lower(coalesce(stage::text,'')) NOT IN('won','closedwon','ganho','lost','closedlost','perdido')) INTO customer,open_deal;
 IF coalesce((definition#>>'{audience,excludeCustomers}')::boolean,true) AND customer THEN RETURN 'customer';END IF;
 IF coalesce((definition#>>'{audience,excludeOpenDeals}')::boolean,true) AND open_deal THEN RETURN 'open_deal';END IF;
 IF coalesce((definition#>>'{audience,excludeOtherSequences}')::boolean,true) AND (
  EXISTS(SELECT 1 FROM public.sequence_enrollments en JOIN public.sequences sq ON sq.id=en.sequence_id AND sq.workspace_id=en.workspace_id WHERE en.workspace_id=r.workspace_id AND en.status='active' AND (
   sq.entity='leads' AND p.entity='lead' AND en.entity_id=p.source_id OR sq.entity='contacts' AND en.entity_id=CASE WHEN p.entity='contact' THEN p.source_id ELSE (SELECT converted_contact_id FROM public.leads WHERE id=p.source_id AND workspace_id=r.workspace_id) END))
  OR EXISTS(SELECT 1 FROM public.sdr_enrollments en WHERE en.workspace_id=r.workspace_id AND en.status='active' AND en.opted_out_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_source->'phones') ph WHERE nullif(regexp_replace(ph,'\D','','g'),'')=regexp_replace(en.contact_phone,'\D','','g')))
 ) THEN RETURN 'other_sequence';END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_commercial_block(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_commercial_block(uuid,jsonb) TO service_role;
