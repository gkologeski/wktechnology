## Tela principal presa em "Verificando acesso…"

**Porte P/M · estimativa 40–70 min** (medição 15 min + correção 25–45 min + testes 10 min).

### O que já confirmei no código
- A mensagem vem do casco logado: a tela inteira espera a checagem de papel (admin/gerente/membro) terminar antes de mostrar qualquer conteúdo — mesmo na Home, que não exige papel especial.
- Essa checagem faz duas consultas ao banco a cada abertura, sem guardar o resultado; se uma falhar, ela nunca termina (fica "Verificando acesso…" para sempre, sem aviso de erro).

### Causa exata: ainda não confirmada
Não medi o tempo das consultas. O primeiro passo é medir no navegador com sua sessão para saber se a demora é a checagem de papel, a de módulos/licenças ou o banco lento.

### O que vou fazer
1. **Medir** a abertura de /home (Playwright + tempos de cada consulta) e confirmar o culpado.
2. **Não bloquear a Home** por checagem de papel: só telas restritas a admin/gerente esperam por ela.
3. **Guardar o resultado** da checagem (reaproveitado ao trocar de tela, atualizado em segundo plano).
4. **Tratar falha**: em vez de esperar para sempre, mostrar "Não foi possível verificar o acesso" com "Tentar novamente" (uma nova tentativa automática antes).
5. Se a medição apontar consulta lenta no banco, propor índice à parte (sem mexer em regras de acesso).

### O que não muda
Regras de quem pode ver o quê, dados e telas restritas continuam protegidas (o bloqueio de admin/gerente segue valendo nelas e no banco).

### Detalhes técnicos
- `src/lib/use-my-role.ts`: migrar de `useEffect`+`useState` para TanStack Query (`staleTime` ~5 min, `retry: 1`, expor `isError`/`refetch`).
- `src/routes/_authenticated.tsx`: `accessPending` passa a considerar `roleLoading` só quando `matches(path, ADMIN_ONLY|MANAGER_PLUS)`; somar erro de papel ao `accessFailed`.
- Teste unitário da regra "rota restrita espera papel; Home não"; `permissions:check`, typecheck, Playwright em /home e numa rota de admin.
