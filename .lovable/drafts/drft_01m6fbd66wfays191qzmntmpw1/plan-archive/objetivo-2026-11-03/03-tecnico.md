## Detalhes técnicos

- Migração aditiva (aplicada ao aceitar o rascunho):
  - Tabela de backup `wa_timeline_backup_2026_11` (snapshot das atividades `type='whatsapp'`), com GRANT/RLS só admin.
  - Nova função de gatilho `wa_register_daily_activity` (security definer) em `whatsapp_messages` para inbound e outbound: chave `external_ids.wa_day = 'conv:<contato>:<YYYY-MM-DD>'`, upsert em `activities` com `external_ids.messages` (array ordenado: id, direção, hora, autor, origem, status, corpo/mídia) e idempotência por `wa_message_id` dentro do array. Atualiza assunto/contagem e `activity_date` = primeira mensagem do dia. O gatilho antigo `wa_outbound_register_activity` é desligado (não excluído).
  - Atualização de status (entregue/lida/falha) reflete no item do array.
  - Índice parcial em `(workspace_id, (external_ids->>'wa_day'))`.
  - Backfill: soft delete (`deleted_at`) de todas as atividades WhatsApp atuais e criação dos blocos diários a partir de `whatsapp_messages`, em lotes, desligando notificações/workflows durante o lote.
- Front: renderizador de conversa no item WhatsApp da timeline (`src/lib/timeline` + componente do card), usando tokens do design system, mantendo etiqueta vermelha de não entregue; fallback para registros sem `messages`.
- Permissões: sem nova tela/ação; leitura segue RLS de `activities`. Contrato de permissões atualizado para os arquivos alterados.
- Testes: agrupamento por dia em fuso de Brasília (23:59 x 00:01), idempotência (mesma mensagem 2x), inbound + outbound no mesmo bloco, ordem por hora. Playwright na ficha do Leonardo Cristiano de Alice após aceitar.
- Limitação do rascunho: a migração não roda antes do aceite, então a tela nova só é verificável com dados reais depois.
