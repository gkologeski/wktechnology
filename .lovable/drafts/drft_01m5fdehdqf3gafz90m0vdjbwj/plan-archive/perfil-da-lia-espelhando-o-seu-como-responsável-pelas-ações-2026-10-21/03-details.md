## Etapas
1. **Inventário (só leitura):** contar no WK o que foi feito pela Lia — `sdr_actions`, atividades/tarefas/notas criadas pelo worker, registros de terceiros/indicações — e quanto disso está hoje com você ou sem responsável. Mostro os números antes de qualquer troca.
2. **Criar a identidade:** usuário de autenticação sem senha e banido para login, `profiles` "Lia (Agente SDR)", membro ativo do WK, com cópia dos seus cargos (`user_job_roles`), equipes e papéis (`user_roles` admin) apenas no WK; marcado como agente (`is_agent`) para ficar fora de "Ver como", convites, e-mails e notificações. Nunca owner.
3. **Novas ações:** o worker passa a usar o ID da Lia como `actorUserId`/`created_by` e como responsável das atividades que ela cria. Repasse humano e reuniões continuam com `assigned_to` da conversa / anfitrião.
4. **Histórico:** backup em tabela própria (id, coluna, valor anterior), troca em lotes só de registros comprovadamente da Lia no WK, sem acionar workflows/notificações, e rotina de desfazer pela cópia. Peço sua confirmação com os números do passo 1 antes de rodar.

## Detalhes técnicos
- Migração aditiva: coluna `profiles.is_agent` (ou equivalente em `workspace_members`), tabela de backup com GRANT/RLS admin-only, função de desfazer; nada removido ou renomeado. Aplica ao aceitar o rascunho.
- ID da Lia guardado na configuração do agente (`sdr_playbooks.assigned_to` já existe para o anfitrião; será criado campo separado `agent_user_id`) e lido por `agent-config.ts`.
- Pontos alterados: `actions.server.ts`, `worker.server.ts` (`actorUserId: null` → Lia), `third-party.server.ts`, `tools/dispatcher.ts` (tarefas/notas da Lia; reunião segue `host_user_id`).
- Filtros de responsável, avatar e `listWorkspaceMembers` exibem a Lia com selo de agente.
- Testes: unitários do worker (autor = Lia, repasse = humano), SQL de backup/desfazer, `verify` e build; Playwright na Inbox, timeline e filtro de responsável. Nenhuma mensagem real enviada, nada publicado.
