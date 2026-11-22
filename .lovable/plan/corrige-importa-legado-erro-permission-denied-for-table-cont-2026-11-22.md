# CORRIGE-IMPORTA-LEGADO — erro "permission denied for table contracts" ao importar contrato legado

Porte: P — estimativa 30–45 min (migration aditiva + teste + contrato de permissão + validação).

## Diagnóstico (confirmado no banco)
- A importação em modo "legado" chama a função `contract_legacy_import_create`, que roda com os direitos do próprio usuário.
- Dentro dela há `SELECT * INTO c FROM contracts WHERE id = p_operation` (checagem de reenvio/idempotência).
- Hoje o usuário conectado não tem leitura da tabela inteira; tem leitura de 56 das 60 colunas. As 4 ocultas de propósito são `public_token`, `hiring_person_id`, `legal_entity_id` e `hiring_request_origin`.
- `SELECT *` pede as 60 colunas, então o banco recusa com "permission denied for table contracts" antes mesmo de gravar. Por isso o erro aparece mesmo para quem tem permissão de importar.
- A importação normal (não legado) não é afetada, porque só devolve `id`.

## Correção
1. Nova migration aditiva (`0454_contract_legacy_import_column_safe.sql` ou o próximo número livre) com `CREATE OR REPLACE FUNCTION public.contract_legacy_import_create(...)` idêntica à atual, trocando apenas a leitura:
   - ler só as colunas usadas: `id, workspace_id, owner_id, source_file_path` e as chaves comparadas no reenvio (lista `allowed` sem `public_token`), montando um `jsonb` em vez de `contracts%ROWTYPE`;
   - a comparação de reenvio continua ignorando `number` e `public_token`, com o mesmo tratamento de `metadata`.
   - Nenhuma mudança em grants, RLS, permissões, chaves ou regras; segurança da função inalterada (continua invoker).
2. Varredura da mesma categoria: listar funções invoker que fazem `SELECT *`/`%ROWTYPE` em `contracts` e corrigir na mesma migration só as que estiverem no caminho de usuário conectado; relatar as demais.
3. Teste PostgreSQL/JWT: importar legado com usuário permitido (sucesso), reenvio com mesmo `operation_id` (replayed, sem duplicar), sem chave, deny, outro workspace e inativo (todos negados), e conferir que as 4 colunas protegidas continuam ilegíveis.
4. Atualizar hash em `docs/security/permission-contracts.json`; rodar `permissions:check` primeiro, depois testes afetados.
5. Aplicação no banco e publicação só após sua revisão do diff/CI, como nos pacotes anteriores.

## Fora do escopo
- Não reabrir leitura das colunas protegidas.
- Não alterar a tela de importação.
