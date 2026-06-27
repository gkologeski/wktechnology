
ALTER TABLE public.ats_sourcing_sequences
  ADD COLUMN IF NOT EXISTS daily_send_limit integer,
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint,
  ADD COLUMN IF NOT EXISTS quiet_hours_end smallint,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS send_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[];

COMMENT ON COLUMN public.ats_sourcing_sequences.daily_send_limit IS 'Máx. de envios por dia para a sequência (NULL = ilimitado).';
COMMENT ON COLUMN public.ats_sourcing_sequences.quiet_hours_start IS 'Hora (0-23) de início da janela silenciosa (no timezone da sequência).';
COMMENT ON COLUMN public.ats_sourcing_sequences.quiet_hours_end IS 'Hora (0-23) de fim da janela silenciosa.';
COMMENT ON COLUMN public.ats_sourcing_sequences.send_days IS 'Dias da semana permitidos (0=domingo .. 6=sábado).';
