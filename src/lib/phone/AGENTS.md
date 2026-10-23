# phone

- `e164.ts` é a única normalização/validação de telefone (navegador e servidor); nada de regex caseira ou outra biblioteca; por quê: mesma resposta em tela, API e importação.
- Sem "+" o país vem do contexto: país do workspace só para dado digitado agora; dado de integração/histórico só com evidência da fonte (`sourcePhone`), senão fica como veio para revisão; por quê: não inventar país, 9º dígito nem completar número.
- Valor legado não editado nunca bloqueia salvar outros campos (`humanPhoneForRow`, `validatePhoneValue({unchangedFrom})`); por quê: PATCH de outro campo não pode falhar por dado antigo.
- Correção de dados existentes usa `scripts/phone-e164/` (prévia → `batch-sql.ts`) com backup em `phone_normalization_items`, grava só quando o valor ainda é o da simulação e registra correções posteriores como execução filha (`parent_run_id`) que resolve itens da fila (`resolved_at`); por quê: idempotente, reversível, seguro contra edição concorrente e sem esconder a fila original.
- A régua "até `PHONE_BLANK_MAX_DIGITS` dígitos não é telefone" e os motivos da fila (`phoneReviewDetail`) vêm do código compartilhado; por quê: tela, servidor, prévia e relatório contam igual.
