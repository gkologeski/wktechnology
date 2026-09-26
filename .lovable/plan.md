# Atividades e tarefas da timeline no padrão HubSpot (TechSales)

## Objetivo
Espelhar na timeline de Leads, Contatos, Empresas e Negócios os controles de atividades e tarefas do HubSpot, tanto no **registro** (compositor) quanto no **cartão** já salvo, sem remover nada do que existe hoje.

## 1. Compositor ("Registrar ...")
Cabeçalho com tipo (Nota, E-mail, Ligação, Reunião, WhatsApp, LinkedIn, SMS, Correspondência, Tarefa), recolher, expandir e fechar.
- **Contatado**: seletor de contatos associados ao registro (ex.: "0 contatos").
- **Data da atividade**: data e hora editáveis (padrão = agora), gravadas como data real da atividade.
- **Campos por tipo**: Ligação → resultado e direção; Reunião → resultado, local e duração; E-mail → direção.
- **Conteúdo**: editor rico atual (negrito, itálico, sublinhado, links, imagem, anexos, snippets, IA, menções, colagem WhatsApp).
- **Associado a N registros**: menu para incluir/remover Contatos, Empresas, Negócios, Leads e Tickets.
- **Criar tarefa de acompanhamento**: caixa + tipo de tarefa + vencimento rápido (Hoje, Amanhã, Em 2 / 3 dias úteis, Em 1 semana, Em 2 semanas, Em 1 mês, Data personalizada). Cria uma tarefa vinculada às mesmas associações.
- Botão principal "Registrar <tipo>" desabilitado até haver conteúdo.

## 2. Compositor de Tarefa
Título, Tipo de tarefa (Tarefas, Ligação, E-mail, LinkedIn…), Prioridade (Nenhuma, Baixa, Média, Alta), Fila, Atribuído a, Data e hora de vencimento, Lembrete, **Definido para repetir** (diária, semanal, mensal, trimestral, anual; intervalo e dias da semana; término: nunca, em data, após N ocorrências), Observações e associações.

## 3. Cartão na timeline (visualização/edição inline)
- Linha superior: seta de recolher, "**Tipo** por / atribuída a <pessoa>", menu **Ações** (Editar, Fixar, Copiar link, Ver histórico, Criar tarefa de acompanhamento, Excluir com confirmação) e **data de criação/atividade** ("4 de nov. de 2022 às 00:00").
- Tarefa: marcador de concluir, título, Data de vencimento (data + hora), Lembrete, Definido para repetir, Fase (Não iniciada, Em andamento, Aguardando, Adiada, Concluída), Tipo, Prioridade, Fila, Atribuído a, Observações — cada campo editável no próprio cartão.
- Demais tipos: Contatado, resultado/direção quando existirem, conteúdo, anexos.
- Rodapé: "Adicionar comentário" (usa os comentários existentes) e "N associações" com menu de associação.

## 4. Repetição de tarefas
Ao concluir uma tarefa com repetição, o sistema cria automaticamente a próxima ocorrência (mesmo título, responsável, associações e regra), respeitando o término definido. Feito no servidor para funcionar também em concluídas por outras telas.

## Fora do escopo
Outros módulos (TechHire, TechService etc.) — ficam para uma próxima etapa usando os mesmos componentes. Nenhuma mudança em permissões/RLS.

## Detalhes técnicos
- Migração aditiva em `activities`: `activity_date timestamptz` (backfill `coalesce(hs_createdate, created_at)`), `task_type text`, `task_queue_id uuid null`, `recurrence jsonb null`, `recurrence_parent_id uuid null`, `contacted_contact_ids uuid[] default '{}'`, `pinned_at timestamptz null`, `follow_up_of uuid null`. Sem alterar colunas existentes (`task_status`, `task_priority`, `remind_before_minutes`, `due_date`, `outcome`, `email_direction` já existem). Fila reaproveita a estrutura de filas de tarefas já usada em Tarefas.
- Associações múltiplas: reaproveitar `associations.functions.ts`/painel de associações; `related_*_id` continua sendo a associação primária.
- Recorrência: função pura `nextOccurrence(rule, from)` com testes vitest; gatilho no servidor ao marcar `completed=true` (server function na conclusão + trigger de banco como garantia, idempotente via `recurrence_parent_id`).
- Componentes novos em `src/components/activity/`: `activity-composer-header`, `contacted-picker`, `associations-menu`, `follow-up-task-control`, `task-fields-grid`, `recurrence-control`, `activity-actions-menu`; `timeline-composer.tsx`, `activity-timeline-item.tsx` e `activity-edit-form.tsx` passam a compô-los. Datas com o seletor pt-BR padrão (`date-picker-br`), tokens do Design System, PT-BR.
- HubSpot sync: mapear `hs_task_type`, `hs_task_priority`, `hs_task_status`, `hs_timestamp` → novos campos quando presentes, sem mudar o fluxo de sincronização.
- Validação: typecheck, lint, vitest (recorrência, atalhos de vencimento), Playwright em desktop/celular, claro/escuro, criando nota com acompanhamento e tarefa recorrente em um Negócio.
