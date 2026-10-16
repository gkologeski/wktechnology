CREATE OR REPLACE FUNCTION public.wa_classify_phone(_raw text)
 RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
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
    IF length(d) BETWEEN 8 AND 15 THEN RETURN ARRAY['foreign', NULL]; END IF;
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
END $function$;