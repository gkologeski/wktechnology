# Corrigir o alerta de atividade dos negócios e fixar a rolagem horizontal das grades

## Objetivo

Corrigir duas inconsistências:

1. O painel não deve marcar um negócio como “Sem atividade há 7+ dias” quando existe uma tarefa ou interação recente vinculada a ele.
2. Grades largas devem manter o controle de rolagem horizontal visível enquanto o usuário percorre listas longas.

## Diagnóstico confirmado

- O negócio **“Negócio - Leandro Milione”** possui uma tarefa `FUP` vinculada ao negócio e ao contato, com vencimento em **24/09/2026**.
- Essa tarefa foi criada em **18/09/2026** e concluída em **28/09/2026**.
- Hoje, o painel calcula a última atividade somente por `activities.created_at`. Por isso, ele considera 18/09 e ignora o vencimento de 24/09, gerando o alerta incorreto.
- O texto atual é “Sem atividade há 7+ dias”, embora a expectativa apresentada seja baseada também em tarefas.
- As tabelas do sistema usam majoritariamente o contêiner compartilhado de `src/components/ui/table.tsx`; sua barra horizontal nativa fica no fim físico da tabela. Em listas altas, ela só aparece depois de rolar toda a página.
- O Kanban já possui uma barra horizontal espelhada e sincronizada, que servirá de referência para a solução compartilhada.

## Implementação

### 1. Corrigir a data efetiva no painel de vendas

- Ajustar a consulta de atividades ligadas a negócios para trazer `type`, `due_date`, `activity_date` e `created_at`.
- Calcular a data efetiva conforme a regra aprovada:
  - **tarefas:** `due_date`, com fallback seguro para `activity_date` e `created_at`;
  - **demais atividades:** `activity_date`, com fallback para `created_at`.
- Garantir que o filtro da consulta não descarte tarefas futuras ou recentes apenas porque foram criadas há mais tempo.
- Manter o vínculo pelo `related_deal_id`, o escopo de workspace e as permissões atuais.
- Manter atividades concluídas na cronologia: uma tarefa realizada recentemente continua sendo uma atividade válida do negócio.
- Ajustar o rótulo e a descrição do bloco para refletirem corretamente “atividade”, sem afirmar ausência de tarefa quando o critério inclui outros tipos de interação.

### 2. Criar rolagem horizontal persistente para grades

- Extrair a sincronização de rolagem já usada no Kanban para um componente/hook compartilhado, sem duplicar lógica.
- Aplicar no contêiner padrão de tabelas uma barra horizontal espelhada, visível junto à borda inferior da área disponível enquanto a grade estiver na tela.
- Sincronizar nos dois sentidos: mover a barra persistente move a grade; rolar a grade atualiza a barra.
- Exibir a barra somente quando houver conteúdo horizontal oculto.
- Preservar rolagem por touchpad/toque e `overscroll-x-contain`, evitando o gesto de voltar do navegador.
- Remover contêineres horizontais duplicados nas grades que já envolvem o componente padrão, para existir um único responsável pela rolagem.
- Cobrir também grades HTML próprias relevantes que não usam o componente padrão, reutilizando o mesmo wrapper; não alterar abas, editores, códigos ou listas que apenas usam `overflow` e não são grades de dados.
- Evitar sobreposição com paginação, barra de ações em massa, rodapé e janelas modais.

## Arquivos e áreas previstas

- `src/lib/deals/sales-dashboard.server.ts`
- `src/components/deals/dashboard/deal-panels.tsx`
- `src/components/ui/table.tsx`
- novo componente/hook compartilhado de rolagem horizontal
- grades com wrappers horizontais duplicados ou tabelas HTML próprias, após inventário final durante a implementação
- testes unitários da regra de data efetiva e da sincronização quando aplicável

## Fora do escopo

- Nenhuma mudança no banco, RLS, permissões, automações ou estrutura das atividades.
- Nenhuma alteração no cadastro ou nos dados existentes do contato/negócio.
- Nenhum redesign visual das grades além da barra de rolagem persistente.
- Kanbans mantêm o comportamento atual, salvo a reutilização interna da lógica compartilhada sem mudança visual.

## Validação

- Teste da regra com tarefa criada em 18/09 e vencida em 24/09, confirmando que o negócio não recebe alerta em 28/09.
- Casos de tarefa sem vencimento, atividade com `activity_date`, fallback para `created_at` e negócio realmente parado há mais de sete dias.
- Verificação visual em `/dashboard` com o negócio de Leandro Milione.
- Verificação de grades longas e largas em Contratos, Contatos, Empresas, Negócios, ATS, People, Financeiro e Projetos.
- Conferência em desktop e celular, incluindo barra de ações em massa e janelas com tabela.
- Typecheck, ESLint dos arquivos alterados, testes relevantes, build e smoke test no navegador.
