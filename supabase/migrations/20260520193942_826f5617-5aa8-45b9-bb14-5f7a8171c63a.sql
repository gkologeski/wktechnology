-- 1) Preencher related_company_id a partir do contato vinculado
UPDATE public.activities a
   SET related_company_id = c.company_id
  FROM public.contacts c
 WHERE a.related_contact_id = c.id
   AND a.related_company_id IS NULL
   AND c.company_id IS NOT NULL
   AND a.owner_id = c.owner_id;

-- 2) Preencher related_company_id a partir do negócio vinculado
UPDATE public.activities a
   SET related_company_id = d.company_id
  FROM public.deals d
 WHERE a.related_deal_id = d.id
   AND a.related_company_id IS NULL
   AND d.company_id IS NOT NULL
   AND a.owner_id = d.owner_id;

-- 3) Preencher related_contact_id a partir do contato principal do negócio
UPDATE public.activities a
   SET related_contact_id = d.primary_contact_id
  FROM public.deals d
 WHERE a.related_deal_id = d.id
   AND a.related_contact_id IS NULL
   AND d.primary_contact_id IS NOT NULL
   AND a.owner_id = d.owner_id;

-- 4) Preencher related_contact_id a partir do primeiro contato associado ao negócio (quando não há principal)
WITH first_contact AS (
  SELECT DISTINCT ON (dc.deal_id) dc.deal_id, dc.contact_id
    FROM public.deal_contacts dc
   ORDER BY dc.deal_id, dc.contact_id
)
UPDATE public.activities a
   SET related_contact_id = fc.contact_id
  FROM first_contact fc
 WHERE a.related_deal_id = fc.deal_id
   AND a.related_contact_id IS NULL;

-- 5) Segunda passagem: agora que mais atividades têm contato, preencher empresa
UPDATE public.activities a
   SET related_company_id = c.company_id
  FROM public.contacts c
 WHERE a.related_contact_id = c.id
   AND a.related_company_id IS NULL
   AND c.company_id IS NOT NULL
   AND a.owner_id = c.owner_id;