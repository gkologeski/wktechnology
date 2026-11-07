# Plano DESLIGA-AGENDA — Agenda do usuário logado + desligamento governado

Código do plano: **DESLIGA-AGENDA** (pode ser pedido no futuro como "implemente o plano DESLIGA-AGENDA").

Porte: **M** — estimativa **3h a 4h** (código, migration, workflow, testes, Ajuda e Playwright). Sem publicação até você pedir.

## 0. Memória de códigos de plano (primeiro passo)
- Salvar na memória do projeto (Core) a regra: todo plano/implementação recebe um código fácil de lembrar no formato `PALAVRA-PALAVRA` (tema em PT-BR, maiúsculas, ex.: `DESLIGA-AGENDA`), escrito no título do plano, no relatório final e no arquivo arquivado do plano; pedidos com o código devem recuperar o plano arquivado e o histórico da conversa antes de executar.
- Salvar também a preferência: ligações entre módulos devem ser feitas preferencialmente via Workflows.

## 1. Agenda na reunião (Vincular ao usuário logado + ignorar desconectadas + seletor + auto-desativar)
- O modal "Marcar reunião" passa a escolher por padrão a conta de agenda **do próprio usuário logado**, ativa e sem erro; nunca a conta mais recente do workspace.
- Contas desconectadas, com erro ou de membros inativos ficam fora da lista.
- Seletor visível "Agenda para sincronizar" no modal (só as contas permitidas ao usuário; admin vê as do workspace). Sem conta válida: aviso "Conecte sua agenda Google" e a reunião é salva sem sincronizar.
- Servidor valida que a conta escolhida pertence ao usuário (ou que ele é admin) — não confia só na tela.
- Quando o Google responder "Account has been deleted"/token revogado: desligar a sincronização da conta, marcar status de erro e mostrar aviso amigável, sem tentar de novo.

## 2. Ação imediata — caso da Cristiane
- Inativar a Cristiane no workspace (status inativo, preservando o nome nos históricos).
- Desligar a sincronização da agenda e do e-mail dela.
- Transferir para **Eduarda Astran** os registros dela: 25 leads, 9 negócios, 26 contatos, 24 empresas e 218 atividades (contagens serão reconferidas antes e depois).
- Registrar a operação na trilha de auditoria.

## 3. Automação de desligamento (via Workflow)
- Novo evento de domínio publicado quando uma pessoa no TechPeople muda para "Desligado" (ou "Em desligamento" com data de saída atingida).
- Workflow padrão "Desligamento de colaborador" (opt-in por workspace, desligado por padrão) com ações:
  1. inativar o acesso do usuário vinculado (pelo e-mail corporativo/vínculo existente);
  2. desligar agendas e caixas de e-mail conectadas;
  3. reatribuir a carteira (leads, negócios, contatos, empresas, atividades abertas) ao responsável configurado no workflow (padrão: gestor da pessoa; sem gestor, cria tarefa para admin escolher);
  4. notificar o admin com o resumo.
- Sem vínculo claro entre pessoa e usuário: não age sozinho, abre pendência para revisão manual.
- Permissão própria para configurar/executar a automação (sem concessão automática a cargos), com testes de permitido, negado, deny, outro workspace e inativo.

## 4. Ajuda e validação
- Atualizar artigos de Ajuda (Reuniões/Agenda e Desligamento no TechPeople) com bump de versão.
- `permissions:check`, testes novos (escolha da conta, bloqueio de conta alheia, auto-desativação, workflow de desligamento) e Playwright marcando reunião com seu usuário.

## Detalhes técnicos
- Arquivos prováveis: modal de reunião em `src/components/**/meeting*`, sync em `src/lib/calendar/*google*.server.ts`, eventos em `domain_events`, ações de workflow em `src/lib/workflows/` (ler AGENTS.md local), migration nova para evento/ação/permissão.
- Transferência da Cristiane por SQL de dados (não migration), com contagens antes/depois.
