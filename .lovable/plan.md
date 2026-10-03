# Modo papel: gravar só dados de teste, isolados e apagados em 1h

## Resultado esperado
- No "Ver como papel" será possível criar e editar registros para testar fluxos (ex.: criar lead).
- Tudo o que o papel de teste criar fica marcado numa **tabela de controle separada**. Só esses registros podem ser alterados ou excluídos no teste.
- Registros reais continuam protegidos: não podem ser alterados, excluídos nem ligados a registros de teste.
- Mensagens (WhatsApp, chat, e-mail), notificações, cobranças, automações e integrações externas continuam bloqueadas no modo papel.
- Ao sair ou em até 1 hora, os registros de teste e a conta temporária são apagados automaticamente. Se algo falhar, a conta fica bloqueada e a limpeza é repetida.

## Por que uma tabela de controle, e não cópias das tabelas
Copiar cada tabela (leads, empresas, negócios etc.) exigiria duplicar todas as telas e consultas, com alto risco de erro. A alternativa segura: os dados de teste ficam nas tabelas normais, mas **cada linha criada é registrada automaticamente na tabela de controle**, e o banco só permite ao papel mexer no que estiver nela. A limpeza usa essa lista exata — nunca nome ou data.

## Etapas
1. **Tabela de controle e registro automático.** Criar a tabela que guarda sessão, tabela, id do registro e momento. Um gatilho em cada tabela de negócio registra toda linha criada durante uma sessão de papel.
2. **Regras do banco.** Trocar o bloqueio total do papel por: criar permitido; alterar/excluir só registros listados na tabela de controle; ligação a registros reais bloqueada nas tabelas de vínculo. Tabelas sem isolamento seguro continuam bloqueadas.
3. **Ações do servidor.** Ações que usam acesso privilegiado, Workflows, notificações, licenças e integrações continuam recusando o papel de teste com aviso claro.
4. **Limpeza.** Apagar os registros da lista em ordem de dependência, depois a conta. Executar ao sair e na rotina agendada a cada tick; registrar falhas e repetir.
5. **Interface.** Faixa do papel passa a dizer "Modo teste: o que você criar será apagado em até 1h; dados reais não podem ser alterados". Mensagens de bloqueio amigáveis.
6. **Validação (Playwright, desktop e celular).** Como papel: criar lead (permitido), editar lead real (negado), enviar mensagem (negado), sair e conferir que lead e conta sumiram. Simular expiração e falha de limpeza. Confirmar que o modo pessoa (Eduarda) não mudou.

## Detalhes técnicos
- Migration aditiva: `view_as_test_records (id, session_id, workspace_id, table_name, record_id, created_at)` com GRANT a `authenticated`/`service_role`, RLS (admin dono e service_role).
- Função `is_role_test_session()` e `is_test_record(table, id)` SECURITY DEFINER; trigger AFTER INSERT genérico nas tabelas com `workspace_id` grava a linha quando a sessão ativa é `mode='role'`.
- Substituir as policies restritivas `view_as_ro_*` do papel: INSERT liberado; UPDATE/DELETE com `is_test_record(...)`. Tabelas de vínculo (deal_contacts etc.) exigem que ambos os lados sejam de teste. Lista de tabelas liberadas começa pelo TechSales (leads, companies, contacts, deals, activities); demais seguem bloqueadas.
- `assertNotReadOnlyView` mantido em envios, Workflows e funções com `supabaseAdmin`.
- `cleanupExpiredRoleViews` passa a apagar pela tabela de controle (ordem: filhos → pais) antes de remover a conta; mantém `blocked` em falha.
- Atualizar `AGENTS.md` com a regra de isolamento do papel.
