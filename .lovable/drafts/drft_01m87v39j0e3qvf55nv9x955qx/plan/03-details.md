## Detalhes técnicos
- `src/lib/proposals/proposal-templates.functions.ts`: `.delete().eq("template_id", id).select("template_id")` e tratar o erro (hoje é ignorado silenciosamente se não lançado).
- Causa: `checkedMutationClient` (`sales-permission.middleware.ts`, `server: true`) acrescenta `.select("id")` em update/delete sem select.
- Auditar `src/lib/segments.functions.ts` e `unlink-deal-contact.ts` pelo mesmo padrão.
- Teste unitário: salvar modelo existente usa retorno `template_id`, nunca `id`, na tabela de vínculo.
- Atualizar hash do contrato em `docs/security/permission-contracts.json`; rodar `permissions:check`, teste, `verify:changed`, build; Playwright editando um modelo no rascunho.
- Não publicar sem sua aprovação.
