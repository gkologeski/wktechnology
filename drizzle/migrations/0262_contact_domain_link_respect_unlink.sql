CREATE OR REPLACE FUNCTION public.contact_link_company_by_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE dom text;target uuid;n integer;free text[]:=ARRAY['gmail.com','hotmail.com','outlook.com','outlook.com.br','live.com','msn.com','yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me','zoho.com','gmx.com','mail.com','uol.com.br','bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com','r7.com','oi.com.br','superig.com.br'];BEGIN
 IF NEW.company_id IS NOT NULL OR NEW.workspace_id IS NULL OR NEW.email IS NULL OR position('@' in NEW.email)=0 THEN RETURN NEW;END IF;
 -- Desassociação explícita (empresa removida, e-mail inalterado) nunca é desfeita pelo domínio.
 IF TG_OP='UPDATE' AND OLD.company_id IS NOT NULL AND NEW.email IS NOT DISTINCT FROM OLD.email THEN RETURN NEW;END IF;
 dom:=lower(trim(split_part(NEW.email,'@',2)));
 IF dom='' OR dom=ANY(free) THEN RETURN NEW;END IF;
 SELECT count(*),min(id::text)::uuid INTO n,target FROM companies WHERE workspace_id=NEW.workspace_id AND deleted_at IS NULL AND (lower(trim(coalesce(domain,'')))=dom OR lower(split_part(regexp_replace(coalesce(website,''),'^https?://',''), '/',1)) IN(dom,'www.'||dom));
 IF n=1 THEN NEW.company_id:=target;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contact_link_company_by_domain() FROM PUBLIC,anon,authenticated;