# Por que o celular do Vinicius Silva não veio do Apollo

## Diagnóstico (verificado)

O lead `Vinicius Silva` (orbesys, LinkedIn `/in/viniciusconex`) está sem `email`, sem `phone` e sem `mobile_phone`. O enriquecimento rodou pelo LinkedIn, mas o telefone não podia chegar — por três motivos encadeados:

1. **O telefone da Apollo é assíncrono.** Em `people/match`, `reveal_phone_number` só devolve números depois, via `webhook_url`. A resposta imediata do match praticamente nunca traz `phone_numbers`, então o painel de qualificação nunca vê celular.
2. **O webhook está inoperante.** A URL enviada à Apollo é `.../api/public/hooks/apollo-phone` **sem** `?secret=`, e a rota exige `APOLLO_WEBHOOK_SECRET` — que não está configurado no ambiente. Resultado: 503/401 em toda entrega da Apollo, e nenhum número é gravado.
3. **A correlação depende de e-mail.** O processador do webhook só casa a pessoa por `email` (`ilike`). Esse lead não tem e-mail, então mesmo com o webhook funcionando o número seria descartado.

## Correções propostas

1. **Segredo do webhook**: criar `APOLLO_WEBHOOK_SECRET` e anexá-lo à URL gerada (`?secret=...`) em `apolloPhoneWebhookUrl()`, para que a Apollo autentique corretamente.
2. **Correlação sem e-mail**: passar um identificador nosso na chamada (LinkedIn normalizado + id do lead) e persistir um registro de "revelação pendente" (lead/contato, sinal usado, `apollo_person_id`, LinkedIn). O webhook passa a casar por, na ordem: `apollo_person_id` → `linkedin_url` normalizado → e-mail.
3. **Feedback na qualificação**: quando a revelação for pedida, o painel mostra estado "telefone em revelação pela Apollo" e atualiza o campo quando o webhook chegar (invalidação da query do lead), em vez de mostrar silenciosamente vazio.
4. **Diagnóstico**: registrar aviso explícito quando `reveal_phone_number` não é solicitado (webhook inválido/secret ausente) e expor isso nos avisos do enriquecimento, para não parecer que "a Apollo não tem o número".
5. **Reprocessar este lead**: após 1–2, refazer o enriquecimento pelo LinkedIn e confirmar a gravação de `mobile_phone`.

## Detalhes técnicos

- `src/lib/integrations/apollo-enrich.server.ts`: `apolloPhoneWebhookUrl()` com secret; enviar `webhook_url` só quando o secret existir; adicionar warning quando ausente.
- Nova tabela `apollo_phone_reveals` (workspace_id, entity_type, entity_id, apollo_person_id, linkedin_url, email, status, created_at) com `CREATE TABLE → GRANT → RLS → POLICY` (acesso apenas `service_role` + leitura autenticada do próprio workspace).
- `src/lib/integrations/apollo-phone-webhook.server.ts`: resolver alvo por `apollo_person_id` / `linkedin_url` / `email`; manter regra de não sobrescrever valores existentes; marcar a revelação como concluída.
- `src/lib/prospecting/qualification-enrichment.functions.ts` + `src/components/prospecting/qualification-panel.tsx`: estado de revelação pendente e refetch.
- Sem alteração de RBAC, schema de leads ou regra de negócio fora do escopo.

## Observação de plano

A revelação de telefone na Apollo exige chave com permissão para o endpoint e consome créditos; se a chave conectada não tiver essa permissão, o warning passará a dizer isso explicitamente em vez de retornar vazio.
