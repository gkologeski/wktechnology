-- Data operation, never a DDL migration. Immutable v1 retained; WK only.
DO $$
DECLARE base jsonb; corrected jsonb;
BEGIN
 SELECT rules INTO STRICT base FROM public.crm_derivation_catalog WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND version=1;
 SELECT jsonb_agg(value ORDER BY (value->>'priority')::integer) INTO corrected FROM (
 SELECT value FROM jsonb_array_elements(base) WHERE (value->>'priority')::integer<>100
 UNION ALL SELECT value FROM jsonb_array_elements($rules$[
 {"priority":10,"pattern":"\\m(hr business partner|hrbp|human resources business partner|business partner (de |em |of )?(rh|recursos humanos)|parceiro de negocios (de |em )?(rh|recursos humanos))\\M","title":"HR Business Partner","area":"Recursos humanos","level":"Especialista"},
 {"priority":11,"pattern":"\\mpeople partner\\M","title":"People Partner","area":"Recursos humanos","level":"Especialista"},
 {"priority":12,"pattern":"\\mtalent acquisition partner\\M","title":"Talent Acquisition Partner","area":"Recursos humanos","level":"Especialista"},
 {"priority":13,"pattern":"\\mproduct owner\\M","title":"Product Owner","area":"Produto","level":"Especialista"},
 {"priority":14,"pattern":"\\m(partner manager|gerente de parcerias)\\M","title":"Gerente de Parcerias","area":"Comercial","level":"Gerência"},
 {"priority":15,"pattern":"\\m(gerente (de )?desenvolvimento de negocios|business development manager)\\M","title":"Gerente de Desenvolvimento de Negócios","area":"Comercial","level":"Gerência"},
 {"priority":16,"pattern":"\\m(diretor tecnico|diretora tecnica|technical director)\\M","title":"Diretor Técnico","level":"Diretoria"},
 {"priority":17,"pattern":"\\mbusiness partner\\M","exclude_pattern":"\\m(hr|rh|human resources|recursos humanos)\\M","title":"Business Partner","level":"Especialista"},
 {"priority":100,"pattern":"\\m(socio|socia)\\M","title":"Sócio","level":"Societário"},
 {"priority":114,"pattern":"\\mpartner\\M","exclude_pattern":"\\m(business partner|people partner|talent acquisition partner|partner manager|hrbp)\\M","title":"Sócio","level":"Societário"},
 {"priority":115,"pattern":"\\mowner\\M","exclude_pattern":"\\mproduct owner\\M","title":"Sócio","level":"Societário"},
 {"priority":116,"pattern":"\\m(fundador|fundadora|founder)\\M","exclude_pattern":"\\m(ceo|cto|cio|cfo|coo|chro|ciso|cdo|chief (executive|technology|information|financial|operating|human resources|information security|data) officer)\\M","title":"Sócio","level":"Societário"},
 {"priority":209,"pattern":"\\m(desenvolvimento de negocios|business development)\\M","area":"Comercial"}
 ]$rules$::jsonb)
 ) q;
 INSERT INTO public.crm_derivation_catalog(workspace_id,version,active,rules) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',2,false,corrected) ON CONFLICT(workspace_id,version) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.crm_derivation_catalog WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND version=2 AND rules=corrected) THEN RAISE EXCEPTION 'Catalog v2 differs: do not overwrite immutable rules'; END IF;
 UPDATE public.crm_derivation_catalog SET active=false WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND active AND version<>2;
 UPDATE public.crm_derivation_catalog SET active=true WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND version=2 AND NOT active;
END $$;