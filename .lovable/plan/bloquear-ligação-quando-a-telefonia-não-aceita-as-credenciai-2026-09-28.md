# Bloquear "Ligação" quando a telefonia não aceita as credenciais

## Por que aparece como liberado hoje
Hoje o botão só confere se as chaves da telefonia estão preenchidas e no formato certo. Elas estão preenchidas, mas a telefonia recusa essa combinação (erro 401). A janela de ligação faz o teste de verdade e mostra o erro. O botão não faz esse teste.

## O que muda
- Um agendamento automático testa as chaves na telefonia às 8h, 11h, 14h e 17h (horário de Brasília) e guarda o resultado.
- O botão "Ligação" lê o último resultado guardado. Se as chaves foram recusadas ou estiverem faltando, ele fica esmaecido, com a engrenagem que leva à configuração e a dica "Telefonia com credenciais inválidas".
- Quando ainda não houver nenhum teste feito, ou se o último teste não tiver conseguido falar com a telefonia (serviço fora do ar ou lento), o botão continua liberado. Nesse caso a janela mostra o aviso atual.
- Quando alguém abre a janela de ligação, o teste que ela já faz também atualiza o resultado guardado. Assim, uma correção das chaves aparece antes do próximo horário agendado.

## Fora do escopo
- Consertar as chaves: você precisa gerar uma nova chave de API no painel do Twilio, na mesma conta, e atualizar o identificador e o segredo. Posso abrir o formulário seguro depois.
- Nenhuma mudança nas permissões ou no envio.

## Detalhes técnicos
- Migration: tabela `channel_health_checks` (channel text PK, ready bool, reason text, checked_at timestamptz), com GRANT de select para authenticated e all para service_role, RLS ativa e policy de leitura para authenticated. Só o servidor grava. As credenciais da telefonia são globais, então basta uma linha (`call`).
- `src/lib/twilio-voice-probe.server.ts`: `probeTwilioVoiceCredentials()` retorna `{ ok, reason, transient }`, com timeout de cerca de 5s. É reutilizada por `getVoiceAccessToken`, que também passa a gravar o resultado.
- Rota `src/routes/api/public/hooks/channel-health.ts` (POST), que valida o `CRON_SECRET`, roda a sonda e faz upsert da linha.
- pg_cron + pg_net via run_sql: `0 11,14,17,20 * * *` UTC, que corresponde a 8h, 11h, 14h e 17h em Brasília.
- `getChannelAvailability`: `call` = `twilioEnvReady` && (sem linha, ou `ready`, ou falha transitória).
- Validação: tsgo, ESLint, teste unitário do mapeamento da sonda, chamada manual da rota e verificação no navegador do botão bloqueado.
