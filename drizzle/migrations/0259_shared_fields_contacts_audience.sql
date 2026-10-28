-- A listagem de Contatos lê esta visão; sem a coluna audience o filtro do TechSales (audience = 'sales') falhava com erro 400.
-- Mesma definição anterior, apenas com audience acrescentada ao final.
CREATE OR REPLACE VIEW public.shared_fields_contacts WITH (security_barrier = true) AS
 WITH field_policy AS MATERIALIZED (
         SELECT shared_field_context() -> 'rules'::text AS rules
        )
 SELECT b.id,
    b.owner_id,
    b.company_id,
    b.first_name,
    b.last_name,
        CASE
            WHEN ((m.rules -> 'techsales.contacts'::text) ->> 'email'::text) = ANY (ARRAY['hidden'::text, 'masked'::text]) THEN NULL::text
            ELSE b.email
        END AS email,
        CASE
            WHEN ((m.rules -> 'techsales.contacts'::text) ->> 'phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text]) THEN NULL::text
            ELSE b.phone
        END AS phone,
    b.job_title,
    b.notes,
    b.created_at,
    b.updated_at,
    b.score,
    b.label,
    b.marketing_status,
    b.legal_basis,
    b.consent_date,
    b.external_ids,
        CASE
            WHEN jsonb_path_exists(COALESCE(m.rules -> 'techsales.contacts'::text, '{}'::jsonb), '$.*?(@ == "hidden" || @ == "masked")'::jsonpath) THEN NULL::jsonb
            ELSE b.hs_raw
        END AS hs_raw,
        CASE
            WHEN ((m.rules -> 'techsales.contacts'::text) ->> 'mobile_phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text]) THEN NULL::text
            ELSE b.mobile_phone
        END AS mobile_phone,
    b.country,
    b.address,
    b.cep,
    b.city,
    b.state,
    b.website,
    b.company_name,
    b.lifecyclestage,
    b.hs_lead_status,
    b.hubspot_owner_id,
    b.hs_object_id,
    b.hs_createdate,
    b.hs_lastmodifieddate,
    b.linkedin_url,
    b.twitter_handle,
    b.custom_fields,
    b.portal_enabled,
    b.workspace_id,
    b.deleted_at,
    b.assigned_user_id,
    b.assigned_to,
        CASE
            WHEN (((m.rules -> 'techsales.contacts'::text) ->> 'phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text])) OR (((m.rules -> 'techsales.contacts'::text) ->> 'mobile_phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text])) THEN NULL::text
            ELSE b.whatsapp_e164
        END AS whatsapp_e164,
    b.cargo_resumido,
    b.area_atuacao,
    b.nivel_hierarquico,
    b.cargo_catalog_version,
    b.photo_url,
    b.photo_source,
    b.photo_updated_at,
    b.phone_ext,
        CASE
            WHEN ((m.rules -> 'techsales.contacts'::text) ->> 'phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text]) THEN NULL::text
            ELSE b.phone_digits
        END AS phone_digits,
        CASE
            WHEN ((m.rules -> 'techsales.contacts'::text) ->> 'mobile_phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text]) THEN NULL::text
            ELSE b.mobile_phone_digits
        END AS mobile_phone_digits,
        CASE
            WHEN (((m.rules -> 'techsales.contacts'::text) ->> 'phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text])) OR (((m.rules -> 'techsales.contacts'::text) ->> 'mobile_phone'::text) = ANY (ARRAY['hidden'::text, 'masked'::text])) THEN NULL::text
            ELSE b.whatsapp_digits
        END AS whatsapp_digits,
    b.audience
   FROM contacts b
     CROSS JOIN field_policy m;