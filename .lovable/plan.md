## Objetivo
Restaurar a gravação do deal `54c49367` (evento `6fc9a4b2`, Meet `eim-xejq-etq`) e corrigir a lacuna estrutural no matcher que fez ela sumir após o patch dual-signal.

## Fase 1 — Restauração pontual (deal Samuel Portel)
1. Via rota temporária de diagnóstico (mesmo padrão da Fase A anterior, token efêmero, com `requireCronAuth`), buscar no Drive de `guilherme@wktechnology.com.br` arquivos de vídeo criados entre 06/07 e 09/07 cujo nome contenha "MOBICONN" ou "WK Technology".
2. Confirmar o ID/nome do arquivo, validar que:
   - é `owned by` o organizador,
   - não contém código de outro Meet no nome.
3. Vincular manualmente ao evento `6fc9a4b2` (`recording_drive_file_id`, `recording_url`, `recording_mime_type`, `recording_status='synced'`, `recording_synced_at=now()`).
4. Remover a rota temporária e limpar `routeTree.gen.ts`.

## Fase 2 — Correção estrutural do matcher
O `findDriveRecording` em `src/lib/calendar/engine.server.ts` faz **uma única** `driveSearch` cuja query filtra por `name contains 'meetCode'`. Quando o Meet não escreve o código no nome, essa consulta volta vazia e o *fallback dual-signal* nunca roda.

Ajuste:
1. Se `driveSearch(meetCode)` retornar 0 candidatos **e** houver `organizerEmail` + `titleTokens`, executar uma segunda `driveSearch` mais ampla:
   - `q = mimeType contains 'video/' and 'organizerEmail' in owners and createdTime > startAt-2h and createdTime < startAt+8h`.
2. Aplicar sobre esse resultado exatamente as mesmas travas do dual-signal atual:
   - propriedade do organizador,
   - nome contém pelo menos 1 `titleToken`,
   - nome NÃO contém código de outro Meet.
3. Preservar todas as demais travas (`cross_link_blocked`, janela de tempo, atribuição por `conference_id` estrito quando houver).
4. Marcar `matched_by = 'title-only (organizador + título, sem meet-code no nome)'` para auditoria.

## Fase 3 — Reprocessamento controlado
1. Selecionar apenas eventos com `recording_status='not_found'` **cuja mensagem de erro contenha "nenhuma gravação com o código do Meet"** dos últimos 30 dias.
2. Zerar `recording_attempts` **somente** desses.
3. Disparar o cron de gravações uma vez e observar o resultado nos próximos 15 min.
4. Relatar quantos eventos passaram para `synced` versus quantos permaneceram `not_found`.

## Fora do escopo
- Não alterar o cron schedule.
- Não mudar regras de vinculação de reuniões a deals/contatos/empresas.
- Não mexer em RLS, permissões ou UI.

## Detalhes técnicos
- Arquivo principal: `src/lib/calendar/engine.server.ts` (funções `driveSearch`, `findDriveRecording`, `syncRecordingForEvent`, `syncPastRecordings`).
- Rota temporária de diagnóstico: `src/routes/api/public/hooks/diag-drive-recording.ts` (criada e removida no mesmo ciclo).
- SQL de restauração pontual e de reprocessamento executados via `psql`.

## Como validar
- Abrir `/deals/54c49367-...` e conferir a gravação na timeline da reunião de 07/07.
- Rodar o cron manualmente e conferir a queda em eventos `not_found` com a mensagem específica.
- Verificar que nenhum evento de outro deal recebeu gravação cruzada (spot-check em 5 eventos aleatórios pós-execução).
