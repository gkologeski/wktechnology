# Tarefas do TechSales: lista não carrega

## O que foi visto
- A busca da lista (50 tarefas da pessoa, ordenadas por criação) estourou o tempo do banco (erro 57014) e a tela mostrou "Tentar novamente". Uma nova tentativa logo depois funcionou — o problema é intermitente.
- Já existe o índice certo para essa busca (responsável + data de criação, só tarefas). Por isso a causa provável é a mesma de Pessoas/Chat: a conferência de permissão das atividades (428 mil registros, 53 mil tarefas) sendo refeita linha a linha. **Causa ainda não confirmada** — o primeiro passo é medir.

## O que farei
1. Medir a busca exata da tela com a sua conta (plano de execução real) e identificar qual regra de permissão pesa.
2. Ajustar essa regra para conferir uma vez por consulta, em vez de por registro, sem mudar quem vê o quê. Conferir antes/depois que a mesma busca devolve as mesmas quantidades.
3. Se a medição mostrar que o gargalo é a contagem total da lista, trocar por contagem leve.
4. Testar a tela de Tarefas no navegador (filtros "Minhas", ordenar por prazo, trocar página).

## Fora do escopo
Visual da tela, regras de quem pode ver tarefas, outras telas.

## Estimativa
Porte P/M — 30 a 60 min. Depende só do banco; nada é publicado sem seu aceite.

## Detalhes técnicos
- Requisição: `activities?type=eq.task&deleted_at=is.null&or=(assigned_to.in.(...))&order=created_at.desc&limit=50`, `count=estimated`.
- Índice existente: `activities_tasks_assigned_created_idx (assigned_to, created_at DESC) WHERE type='task' AND deleted_at IS NULL`.
- Correção esperada: migration envolvendo chamadas de função nas políticas RLS de `activities` em `(select ...)` (initplan), com teste de equivalência de contagem e contrato em `permission-contracts.json`.
