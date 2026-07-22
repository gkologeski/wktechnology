## Plano de correção

1. **Corrigir a semântica de permissões editadas**
   - Ajustar o backend da matriz para diferenciar permissões herdadas/padrão de permissões explicitamente removidas.
   - Hoje, ao desmarcar uma permissão já pré-habilitada em cargo de sistema, a UI remove otimisticamente, mas a leitura efetiva volta a mostrar a permissão porque ela ainda vem do conjunto padrão vinculado ao cargo.

2. **Persistir negações por cargo**
   - Criar uma estrutura de override por workspace/cargo/permissão com estado `granted` ou `denied`.
   - Aplicar essa estrutura na função que calcula permissões efetivas, para que uma permissão marcada como negada não volte a aparecer por herança do padrão.
   - Manter o botão **Restaurar padrões** limpando os overrides e recriando o estado original.

3. **Atualizar a matriz em `/settings/permissions`**
   - Fazer `getMatrixState` retornar o estado final considerando padrões + overrides.
   - Fazer `setRolePermission` gravar concessão/negação de forma idempotente.
   - Fazer `bulkSetRolePermissions` respeitar a mesma lógica para “Conceder todas” e “Remover todas”.
   - Melhorar a mensagem de erro caso a ação seja bloqueada por permissão/RLS.

4. **Preservar segurança e escopo**
   - Restringir edição aos admins/owners do workspace atual.
   - Não liberar leitura/escrita pública.
   - Não alterar permissões de negócio fora do módulo RBAC.

5. **Validação**
   - Testar manualmente a sequência: desmarcar permissão pré-habilitada, aguardar refetch, confirmar que ela permanece desmarcada; remarcar e confirmar persistência; restaurar padrões e confirmar retorno ao snapshot padrão.
   - Executar validações disponíveis relevantes para TypeScript/build conforme scripts do projeto.