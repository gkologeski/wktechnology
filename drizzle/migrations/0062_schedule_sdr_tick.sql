-- lovable-cron-fallback-reviewed: follow-ups do SDR e conciliação de reuniões com o Google são baseados em tempo (sem evento de origem); respostas de clientes já acordam o worker na chegada. A rotina retorna sem trabalho enquanto nenhum workspace ligar o SDR.
DO $$
DECLARE v_cmd text;
BEGIN
  SELECT replace(command, '/api/public/hooks/whatsapp-campaign-tick', '/api/public/hooks/sdr-tick')
    INTO v_cmd FROM cron.job WHERE jobname = 'whatsapp-campaign-tick';
  IF v_cmd IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sdr-tick') THEN
    PERFORM cron.schedule('sdr-tick', '*/15 * * * *', v_cmd);
  END IF;
END $$;