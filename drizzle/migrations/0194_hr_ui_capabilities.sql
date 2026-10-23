-- Stage 4: bounded, caller-bound UI capabilities. No new role grants or row writes.
CREATE OR REPLACE FUNCTION public.hr_record_capabilities(_resource text,_ids uuid[])
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,can_delete boolean,can_create_child boolean,can_edit_settings boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF _resource NOT IN('people','candidates','onboarding_plans','onboarding_tasks','onboarding_templates')
   OR _resource IS NULL OR _ids IS NULL OR cardinality(_ids)>200 THEN
   RAISE EXCEPTION 'Invalid capability request' USING ERRCODE='22023';
 END IF;
 FOR id IN SELECT DISTINCT v FROM unnest(_ids) v WHERE v IS NOT NULL LOOP
   can_view:=public.hr_record_access(_resource,'view',id);
   can_update:=can_view AND public.hr_record_access(_resource,'update',id);
   can_delete:=can_view AND public.hr_record_access(_resource,'delete',id);
   can_create_child:=can_view AND _resource='onboarding_plans' AND public.hr_record_access(_resource,'create',id);
   can_edit_settings:=can_update;
   IF _resource='onboarding_tasks' THEN
     -- Assignees may update status; editing task settings requires plan update.
     can_edit_settings:=can_update AND COALESCE((SELECT public.hr_record_access('onboarding_plans','update',t.plan_id)
       FROM public.people_onboarding_tasks t WHERE t.id=hr_record_capabilities.id),false);
   END IF;
   RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hr_record_capabilities(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_record_capabilities(text,uuid[]) TO authenticated;
