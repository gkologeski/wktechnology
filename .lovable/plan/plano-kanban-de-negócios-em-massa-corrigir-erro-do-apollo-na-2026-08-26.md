# Plano: Kanban de Negócios em massa + corrigir erro do Apollo na qualificação

## Parte 1 — Kanban de Negócios: mover e editar em massa

### Situação atual (verificada)
- `/deals` renderiza o quadro via `DealsBoard` com `selectable` e `canDelete`.
- `DealsBoard` já tem seleção de cards e a barra de ações em massa (`GridBulkBar`), que oferece editar em massa via `BulkEditFieldsDialog` para a entidade `deals` (já presente na lista de entidades habilitadas).
- O drag-and-drop atual usa apenas o card arrastado (`e.active.id`), então mover 2 selecionados move somente um.
- `DealsBoard` não passa `canUpdate` explicitamente pela tela; usa o padrão `true`, sem checagem de RBAC granular como no modo tabela.

### O que será feito
1. Movimentação em massa por arrasto:
   - Se o card arrastado estiver selecionado, mover todos os selecionados para a etapa destino.
   - Se não estiver selecionado, manter o comportamento atual (move só ele).
   - Atualizar `stage_id` e também `stage` quando a etapa destino for legada ou de tipo `won`/`lost`.
   - Usar `.select("id")` no update para detectar bloqueio por RLS e avisar quando parte da seleção não foi movida.
   - Invalidar as queries de negócios e limpar a seleção ao final.
   - Etapa de tipo `lost`: manter o diálogo de motivo, aplicando o motivo informado a todos os negócios do lote movido.
2. Edição em massa de qualquer campo:
   - Garantir que a barra em massa do quadro habilite "Editar em massa" com o mesmo catálogo dinâmico do modo tabela.
   - Passar `canUpdate` para `DealsBoard` a partir da permissão granular de atualização de negócios, alinhando com o comportamento do grid.
   - Reaproveitar `GridBulkBar` + `BulkEditFieldsDialog` sem criar diálogo novo.

### Arquivos previstos
- `src/components/deals/deals-board.tsx`
- `src/routes/_authenticated/deals.tsx` (apenas passar as permissões ao quadro)

## Parte 2 — Erro do Apollo ao qualificar lead

### Diagnóstico (verificado no código)
- O enriquecimento envia `reveal_phone_number: true` em `people/match`.
- Em `src/lib/integrations/apollo-enrich.server.ts`, `webhook_url` só é enviado quando a variável de ambiente `APOLLO_PHONE_WEBHOOK_URL` está definida e começa com `http`.
- Em `src/lib/integrations/enrichment-engine.server.ts`, `reveal_phone_number: true` é enviado e `webhook_url` nunca é enviado.
- Já existe a rota pública que recebe os telefones: `src/routes/api/public/hooks/apollo-phone.ts`, com o processamento em `apollo-phone-webhook.server.ts`.
- Portanto o 400 `WEBHOOK_URL_REQUIRED` ocorre porque a requisição pede revelação de telefone sem informar o webhook.

### O que será feito
1. Resolver a URL do webhook automaticamente no servidor:
   - Usar `APOLLO_PHONE_WEBHOOK_URL` quando definida.
   - Caso contrário, derivar da URL pública da aplicação apontando para a rota pública já existente do webhook de telefone.
2. Tornar o pedido de telefone seguro:
   - Só enviar `reveal_phone_number: true` quando houver uma `webhook_url` HTTPS válida.
   - Sem webhook resolvido, fazer o match sem revelação de telefone, registrando um aviso no resultado do enriquecimento em vez de estourar erro na tela de qualificação.
3. Aplicar a mesma regra no caminho `enrichment-engine.server.ts`, que hoje nunca envia `webhook_url`.
4. Mensagem de erro amigável na qualificação: quando a Apollo recusar a revelação de telefone, seguir com os demais dados enriquecidos e exibir aviso, não bloquear a qualificação.

### Arquivos previstos
- `src/lib/integrations/apollo-enrich.server.ts`
- `src/lib/integrations/enrichment-engine.server.ts`
- Ajuste pontual de exibição de aviso no painel de qualificação, se necessário

## Validações
- `bun run typecheck`
- `bun run lint`
- `bun run test` (inclui testes existentes de integrações)
- Verificação manual:
  - selecionar 2 negócios no quadro e arrastar um deles → ambos mudam de etapa;
  - arrastar card não selecionado → move apenas ele;
  - selecionar 2+ e usar "Editar em massa" alterando qualquer campo;
  - qualificar um lead em `/leads` e confirmar que o enriquecimento conclui sem erro 400.

## Fora do escopo
- Alterar RLS, schema ou regras de negócio de negócios/leads.
- Redesenhar o Kanban ou o painel de qualificação.
- Criar nova integração ou novo provedor de enriquecimento.
