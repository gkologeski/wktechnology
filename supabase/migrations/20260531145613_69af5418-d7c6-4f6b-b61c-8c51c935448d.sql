
-- Auto-link contact to company by email domain
CREATE OR REPLACE FUNCTION public.contact_link_company_by_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_domain text;
  v_found uuid;
  v_free text[] := ARRAY[
    'gmail.com','hotmail.com','outlook.com','outlook.com.br','live.com','msn.com',
    'yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com',
    'aol.com','proton.me','protonmail.com','pm.me','zoho.com','gmx.com','mail.com',
    'uol.com.br','bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com',
    'r7.com','oi.com.br','superig.com.br'
  ];
BEGIN
  IF NEW.company_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.email IS NULL OR position('@' in NEW.email) = 0 THEN RETURN NEW; END IF;

  v_domain := lower(btrim(split_part(NEW.email, '@', 2)));
  IF v_domain = '' OR v_domain = ANY (v_free) THEN RETURN NEW; END IF;

  SELECT id INTO v_found
    FROM public.companies
   WHERE owner_id = NEW.owner_id
     AND deleted_at IS NULL
     AND (
       lower(coalesce(domain,'')) = v_domain
       OR lower(coalesce(website,'')) LIKE '%' || v_domain || '%'
     )
   ORDER BY (lower(coalesce(domain,'')) = v_domain) DESC
   LIMIT 1;

  IF v_found IS NOT NULL THEN
    NEW.company_id := v_found;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_contact_link_company_by_domain ON public.contacts;
CREATE TRIGGER trg_contact_link_company_by_domain
BEFORE INSERT OR UPDATE OF email, company_id ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.contact_link_company_by_domain();

-- Bulk linker callable from app (auth user). Returns number of contacts updated.
CREATE OR REPLACE FUNCTION public.link_contacts_by_email_domain(p_workspace uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_free text[] := ARRAY[
    'gmail.com','hotmail.com','outlook.com','outlook.com.br','live.com','msn.com',
    'yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com',
    'aol.com','proton.me','protonmail.com','pm.me','zoho.com','gmx.com','mail.com',
    'uol.com.br','bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com',
    'r7.com','oi.com.br','superig.com.br'
  ];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (v_uid = p_workspace
          OR public.is_platform_admin(v_uid)
          OR public.is_workspace_member(p_workspace, v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH cand AS (
    SELECT c.id,
           lower(btrim(split_part(c.email, '@', 2))) AS dom
      FROM public.contacts c
     WHERE c.owner_id = p_workspace
       AND c.deleted_at IS NULL
       AND c.company_id IS NULL
       AND c.email IS NOT NULL
       AND position('@' in c.email) > 0
  ),
  matched AS (
    SELECT cand.id,
           (
             SELECT co.id FROM public.companies co
              WHERE co.owner_id = p_workspace
                AND co.deleted_at IS NULL
                AND (lower(coalesce(co.domain,'')) = cand.dom
                     OR lower(coalesce(co.website,'')) LIKE '%' || cand.dom || '%')
              ORDER BY (lower(coalesce(co.domain,'')) = cand.dom) DESC
              LIMIT 1
           ) AS company_id
      FROM cand
     WHERE cand.dom <> '' AND NOT (cand.dom = ANY (v_free))
  ),
  upd AS (
    UPDATE public.contacts c
       SET company_id = m.company_id
      FROM matched m
     WHERE c.id = m.id AND m.company_id IS NOT NULL
    RETURNING c.id
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.link_contacts_by_email_domain(uuid) TO authenticated;
