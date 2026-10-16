CREATE OR REPLACE FUNCTION public.wa_normalize_whatsapp_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE r text[];
BEGIN
  IF NEW.whatsapp_e164 IS NOT NULL AND btrim(NEW.whatsapp_e164) <> '' THEN
    IF TG_OP = 'INSERT' OR NEW.whatsapp_e164 IS DISTINCT FROM OLD.whatsapp_e164 THEN
      r := public.wa_classify_phone(NEW.whatsapp_e164);
      IF r[1] = 'landline' THEN
        RAISE EXCEPTION 'Telefone fixo não pode ser usado como WhatsApp.' USING ERRCODE = '22023';
      ELSIF r[1] <> 'mobile' THEN
        RAISE EXCEPTION 'Use celular do Brasil: DDD + 9 + 8 dígitos.' USING ERRCODE = '22023';
      END IF;
      NEW.whatsapp_e164 := r[2];
    END IF;
  ELSE
    NEW.whatsapp_e164 := NULL;
    IF TG_OP = 'INSERT' OR NEW.mobile_phone IS DISTINCT FROM OLD.mobile_phone
       OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.whatsapp_e164 := public.wa_pick_mobile(NEW.mobile_phone, NEW.phone);
    END IF;
  END IF;
  RETURN NEW;
END $function$;