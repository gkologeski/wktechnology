# Prevenção dos erros 131026 e 131049 nos disparos de WhatsApp

**Porte:** M — **Estimativa:** 3h a 4h (implementação + testes + validação no preview). Depende de publicação para valer em produção.

## Erro 131026 — número sem WhatsApp ou inativo
Como evitar: não insistir em números que a Meta já recusou e usar outro canal.

1. **Marcar o número como "sem WhatsApp"** quando chegar a recusa 131026 (no envio ou no retorno de entrega), registrando data e campanha de origem.
2. **Bloquear na montagem do público e de novo no disparo**: campanhas e sequências pulam esses números com o motivo "Número sem WhatsApp" (mesmo padrão dos bloqueios por opt-out/cliente).
3. **Tentar o próximo número do cadastro** (WhatsApp → Celular → Telefone, nunca fixo) quando houver outro celular válido.
4. **Liberação manual**: botão "Liberar número" na ficha do contato/lead, para quando a pessoa ativar o WhatsApp; a marca expira sozinha após 90 dias.
5. **Sequências**: etapa de WhatsApp com 131026 vira "pulada — sem WhatsApp" e a sequência segue para o próximo canal (e-mail/ligação), sem ficar presa.

## Erro 131049 — bloqueado pela Meta para preservar engajamento
Como evitar: não repetir marketing para a mesma pessoa em pouco tempo e retentar mais tarde.

1. **Não reenviar imediatamente**: o destinatário vai para "aguardando nova tentativa" com data mínima de 7 dias (configurável por campanha).
2. **Contar como contato recente**: a recusa entra na regra de reenvio recente já existente, impedindo outra campanha de marketing de bater na mesma pessoa nesse período.
3. **Limite de tentativas**: após 2 recusas 131049 seguidas, o número sai das campanhas de marketing por 30 dias (liberação manual disponível).
4. **Aviso no planejamento**: na campanha e na sequência, mostrar quantos do público tiveram 131049 recente e sugerir excluí-los ou usar template de utilidade.

## Telas afetadas
- Campanhas WhatsApp: contagem dos bloqueados por motivo e coluna de status "Sem WhatsApp" / "Aguardando nova tentativa".
- Sequências: motivo exibido na execução.
- Ficha de Contato/Lead: selo do bloqueio e ação "Liberar número" (exige permissão).

## Detalhes técnicos
- Nova tabela `whatsapp_number_suppressions` (workspace_id, e164, reason `no_whatsapp|engagement_limit`, count, last_error_at, expires_at, released_by/at) com GRANT + RLS por workspace; gravação só no servidor (webhook de status e resposta do envio).
- Reaproveitar `delivery-error.ts` para classificar e um helper puro `whatsapp-suppression.ts` (decide bloqueio, expiração e nova data), com testes unitários: 131026 bloqueia 90 dias; 131049 adia 7 dias; 2ª 131049 bloqueia 30 dias; liberação manual remove.
- Checagem em `campaign-audience.ts`, no disparo da campanha e no worker de sequência (pular etapa e seguir).
- Permissão nova `whatsapp.suppression_release` registrada no catálogo e em `/settings/permissions`, com testes de permitido/negado/outro workspace/inativo, e contrato em `permission-contracts.json`.
- Backfill: popular a tabela com as recusas 131026/131049 já existentes no histórico.
