-- Vínculo de contato por domínio: a busca de candidatos usa índices (sem RLS por linha
-- nas ~33 mil empresas) e a decisão final continua sob RLS do usuário, só nos candidatos.
CREATE INDEX IF NOT EXISTS companies_ws_domain_norm_idx
  ON public.companies (workspace_id, lower(trim(coalesce(domain,''))))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS companies_ws_website_host_idx
  ON public.companies (workspace_id, lower(split_part(regexp_replace(coalesce(website,''),'^https?://',''),'/',1)))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.contact_domain_company_candidates(_ws uuid, _dom text)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  -- Só responde dentro de gatilho (nunca por chamada direta); o chamador filtra por RLS.
  SELECT CASE WHEN pg_trigger_depth()=0 OR _ws IS NULL OR coalesce(_dom,'')='' THEN '{}'::uuid[]
  ELSE coalesce((SELECT array_agg(id) FROM (
    SELECT id FROM public.companies WHERE workspace_id=_ws AND deleted_at IS NULL
      AND lower(trim(coalesce(domain,'')))=_dom
    UNION
    SELECT id FROM public.companies WHERE workspace_id=_ws AND deleted_at IS NULL
      AND lower(split_part(regexp_replace(coalesce(website,''),'^https?://',''),'/',1)) IN (_dom,'www.'||_dom)
  ) s),'{}'::uuid[]) END
$$;
REVOKE ALL ON FUNCTION public.contact_domain_company_candidates(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_domain_company_candidates(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.contact_link_company_by_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE dom text;target uuid;n integer;cands uuid[];free text[]:=ARRAY['gmail.com','hotmail.com','outlook.com','outlook.com.br','live.com','msn.com','yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me','zoho.com','gmx.com','mail.com','uol.com.br','bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com','r7.com','oi.com.br','superig.com.br'];BEGIN
 IF NEW.company_id IS NOT NULL OR NEW.workspace_id IS NULL OR NEW.email IS NULL OR position('@' in NEW.email)=0 THEN RETURN NEW;END IF;
 -- Desassociação explícita (empresa removida, e-mail inalterado) nunca é desfeita pelo domínio.
 IF TG_OP='UPDATE' AND OLD.company_id IS NOT NULL AND NEW.email IS NOT DISTINCT FROM OLD.email THEN RETURN NEW;END IF;
 dom:=lower(trim(split_part(NEW.email,'@',2)));
 IF dom='' OR dom=ANY(free) THEN RETURN NEW;END IF;
 cands:=public.contact_domain_company_candidates(NEW.workspace_id,dom);
 IF cardinality(cands)=0 THEN RETURN NEW;END IF;
 -- Mesma regra de antes: conta só as empresas visíveis ao usuário (RLS), agora só entre os candidatos.
 SELECT count(*),min(id::text)::uuid INTO n,target FROM companies WHERE id=ANY(cands);
 IF n=1 THEN NEW.company_id:=target;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contact_link_company_by_domain() FROM PUBLIC,anon,authenticated;