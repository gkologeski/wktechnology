# phone

- `e164.ts` é a única normalização/validação de telefone (navegador e servidor); nada de regex caseira ou outra biblioteca; por quê: mesma resposta em tela, API e importação.
- Sem "+" o país vem do contexto: país do workspace só para dado digitado agora; dado de integração/histórico só com evidência da fonte (`sourcePhone`), senão fica como veio para revisão; por quê: não inventar país, 9º dígito nem completar número.
- Valor legado não editado nunca bloqueia salvar outros campos (`humanPhoneForRow`, `validatePhoneValue({unchangedFrom})`); por quê: PATCH de outro campo não pode falhar por dado antigo.
- Correção de dados existentes usa `scripts/phone-e164/` com backup em `phone_normalization_items` e grava só quando o valor ainda é o da simulação; por quê: idempotente, reversível e seguro contra edição concorrente.
