# phone

- `e164.ts` é a única normalização/validação de telefone (navegador e servidor); nada de regex caseira ou outra biblioteca; por quê: mesma resposta em tela, API e importação.
- Sem "+" o país vem do contexto: país do workspace só para dado digitado agora; dado de integração/histórico ou copiado de outro registro só com evidência da fonte (`sourcePhone`), senão grava vazio e o original fica na fonte; por quê: não inventar país, 9º dígito nem completar número, e não ter o registro recusado pela guarda do banco (`phone_strict_e164`).
- Valor legado não editado nunca bloqueia salvar outros campos (`humanPhoneForRow`, `validatePhoneValue({unchangedFrom})`); por quê: PATCH de outro campo não pode falhar por dado antigo.
- Correção de dados existentes usa `scripts/phone-e164/` (prévia → `batch-sql.ts`) com backup em `phone_normalization_items`, grava só quando o valor ainda é o da simulação e registra correções posteriores como execução filha (`parent_run_id`) que resolve itens da fila (`resolved_at`); por quê: idempotente, reversível, seguro contra edição concorrente e sem esconder a fila original.
- A régua "até `PHONE_BLANK_MAX_DIGITS` dígitos não é telefone" e os motivos da fila (`phoneReviewDetail`) vêm do código compartilhado; por quê: tela, servidor, prévia e relatório contam igual.
- Decisão humana sobre item da fila só por `phone_review_resolve` (admin ativo, fora de "Ver como", valor ainda igual ao original, sugestão conferida no banco); por quê: confirmar o 9º dígito exige pessoa, trilha de quem decidiu e desfazer.
