## Detalhes técnicos
1. **Banco (aditivo):** nova tabela `hiring_request_deals` (request_id, deal_id, workspace_id, created_by). A sequência da migração é GRANT → RLS → políticas, com leitura e escrita espelhando as regras de `hiring_requests`. `hiring_requests.deal_id` continua sendo o negócio principal. As validações ficam no gatilho e na RPC `hiring_request_save`: finalidade cliente, mesma entidade, negócio ativo e mesmo workspace, travamento fora do rascunho e projeto/contrato pertencente a qualquer dos negócios. A RPC aceita a lista `deal_ids`. As solicitações atuais não precisam ser convertidas.
2. **Servidor:** `types.ts` e o esquema Zod ganham `deal_ids`. `origin-presentation` confere cada negócio, e as leituras pela ficha, pela aprovação e pela formalização trazem a lista.
3. **Tela:** `preparation-form.tsx` passa a usar o `SearchCreateField` em modo múltiplo, com chips, principal marcado e remoção. `preparation-origin-notice.tsx` mostra a conferência de cada negócio.
4. **Permissões:** o recurso continua sendo o das solicitações (sem chave nova). O contrato vai para `permission-contracts.json`, com os cinco cenários testados no PostgreSQL: permitido, sem chave, deny, outro workspace e inativo.
5. **Ajuda:** atualizar o artigo da contratação de fornecedores, com bump de version, e rodar `help:coverage`.
6. **Validação:** `permissions:check`, `verify`, `build`, `perf:check`, testes de solicitação no PostgreSQL e Playwright na etapa Vínculos.

**Fora do escopo:** o rateio de valor entre os negócios.
