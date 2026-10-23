-- Correções posteriores de telefone (ex.: limpeza de números com até 4 dígitos)
-- registradas como execução filha da varredura E.164, com resolução explícita
-- dos itens da fila. Aditivo.

ALTER TABLE public.phone_normalization_runs
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES public.phone_normalization_runs(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.phone_normalization_runs.parent_run_id IS
  'Execução de correção posterior: aponta para a varredura cuja fila de revisão ela resolve em parte.';

ALTER TABLE public.phone_normalization_items
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_run_id uuid REFERENCES public.phone_normalization_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution text;
COMMENT ON COLUMN public.phone_normalization_items.resolved_at IS
  'Item da fila resolvido por uma execução posterior (resolved_run_id). Backup do valor fica no item da execução que gravou.';

CREATE INDEX IF NOT EXISTS phone_norm_items_open_idx
  ON public.phone_normalization_items (run_id, classification)
  WHERE applied_at IS NULL AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS phone_norm_items_row_idx
  ON public.phone_normalization_items (workspace_id, table_name, column_name, row_id);

-- Correção de telefone em lote (token estreito, só WK, sem sessão de usuário)
-- não cria WhatsApp derivado: o canal continua como estava antes da correção.
CREATE OR REPLACE FUNCTION public.wa_normalize_whatsapp_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
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
    IF TG_OP = 'UPDATE' AND coalesce(current_setting('app.phone_e164_backfill', true), '') <> '' THEN
      IF public.crm_is_derivation_backfill(to_jsonb(OLD), to_jsonb(NEW)) THEN
        NEW.whatsapp_e164 := OLD.whatsapp_e164;
        RETURN NEW;
      END IF;
    END IF;
    NEW.whatsapp_e164 := NULL;
    IF TG_OP = 'INSERT' OR NEW.mobile_phone IS DISTINCT FROM OLD.mobile_phone
       OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.whatsapp_e164 := public.wa_pick_mobile(NEW.mobile_phone, NEW.phone);
    END IF;
  END IF;
  RETURN NEW;
END $function$;