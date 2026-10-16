CREATE OR REPLACE FUNCTION public.wa_classify_phone(_raw text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE plus boolean; d text; ddd text; loc text;
BEGIN
  IF _raw IS NULL OR _raw ~ '^[\s\-–—.0]*$' THEN RETURN ARRAY['invalid', NULL]; END IF;
  plus := _raw ~ '^\s*\+';
  d := regexp_replace(regexp_replace(_raw,'\s*(ramal|ext\.?|r\.|x)\s*\d+\s*$','','i'),'\D','','g');
  IF d LIKE '00%' THEN d := substr(d,3);
  ELSIF NOT plus AND d LIKE '0%' THEN
    IF length(d) IN (13,14) THEN d := substr(d,4); ELSE d := ltrim(d,'0'); END IF;
  END IF;
  IF (plus OR length(d) > 13) AND d NOT LIKE '55%' THEN
    IF length(d) BETWEEN 8 AND 15 THEN RETURN ARRAY['foreign', '+'||d]; END IF;
    RETURN ARRAY['invalid', NULL];
  END IF;
  IF length(d) IN (10,11) THEN d := '55'||d; END IF;
  IF d NOT LIKE '55%' OR length(d) NOT IN (12,13) THEN RETURN ARRAY['invalid', NULL]; END IF;
  ddd := substr(d,3,2); loc := substr(d,5);
  IF ddd !~ '^[1-9][1-9]$' THEN RETURN ARRAY['invalid', NULL]; END IF;
  IF length(loc) = 9 THEN
    IF loc LIKE '9%' THEN RETURN ARRAY['mobile', '+55'||ddd||loc]; END IF;
    RETURN ARRAY['invalid', NULL];
  END IF;
  IF loc ~ '^[6-9]' THEN RETURN ARRAY['mobile', '+55'||ddd||'9'||loc]; END IF;
  IF loc ~ '^[2-5]' THEN RETURN ARRAY['landline', '+55'||ddd||loc]; END IF;
  RETURN ARRAY['invalid', NULL];
END $$;

CREATE OR REPLACE FUNCTION public.wa_pick_mobile(VARIADIC _fields text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE f text; c text; r text[];
BEGIN
  FOREACH f IN ARRAY _fields LOOP
    CONTINUE WHEN f IS NULL;
    FOR c IN SELECT trim(x) FROM regexp_split_to_table(f, '[/;,|\n]+|\s+(e|ou)\s+') x LOOP
      CONTINUE WHEN c = '';
      r := public.wa_classify_phone(c);
      IF r[1] = 'mobile' THEN RETURN r[2]; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.wa_normalize_whatsapp_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r text[];
BEGIN
  IF NEW.whatsapp_e164 IS NOT NULL AND btrim(NEW.whatsapp_e164) <> '' THEN
    IF TG_OP = 'INSERT' OR NEW.whatsapp_e164 IS DISTINCT FROM OLD.whatsapp_e164 THEN
      r := public.wa_classify_phone(NEW.whatsapp_e164);
      IF r[1] = 'landline' THEN
        RAISE EXCEPTION 'Telefone fixo não pode ser usado como WhatsApp.' USING ERRCODE = '22023';
      ELSIF r[1] NOT IN ('mobile','foreign') THEN
        RAISE EXCEPTION 'Número de WhatsApp inválido. Use DDD + celular.' USING ERRCODE = '22023';
      END IF;
      NEW.whatsapp_e164 := r[2];
    END IF;
  ELSE
    NEW.whatsapp_e164 := NULL;
    -- Preenche automaticamente a partir de Celular/Telefone quando vazio.
    IF TG_OP = 'INSERT' OR NEW.mobile_phone IS DISTINCT FROM OLD.mobile_phone
       OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.whatsapp_e164 := public.wa_pick_mobile(NEW.mobile_phone, NEW.phone);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_e164 ON public.contacts;
CREATE TRIGGER trg_whatsapp_e164 BEFORE INSERT OR UPDATE OF whatsapp_e164, mobile_phone, phone
  ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.wa_normalize_whatsapp_column();
DROP TRIGGER IF EXISTS trg_whatsapp_e164 ON public.leads;
CREATE TRIGGER trg_whatsapp_e164 BEFORE INSERT OR UPDATE OF whatsapp_e164, mobile_phone, phone
  ON public.leads FOR EACH ROW EXECUTE FUNCTION public.wa_normalize_whatsapp_column();