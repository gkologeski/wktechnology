# Importação completa do ClickUp para o TechProjects (sem duplicar)

Porte: G. Estimativa: 3 a 5 dias de trabalho, em 4 entregas. A duração real depende do volume do ClickUp (só sabemos após a leitura) e do tempo de revisão da proposta por você.

## Objetivo
Ler tudo o que seu usuário acessa no ClickUp (todos os workspaces), comparar com o que já existe no TechProjects (172 projetos e 15.862 tarefas vindos de Clockify/Jibble), propor uma organização e só importar depois da sua aprovação. Nada é gravado sem aceite; nada que já exista é duplicado.

## Entrega 1 — Leitura (somente leitura, ~1 dia)
- Conferir a conexão atual do ClickUp (existe 1 registro); se faltar acesso a todos os workspaces, pedir reconexão.
- Copiar para uma área de preparação: workspaces, espaços, pastas, listas, tarefas, subtarefas, checklists, comentários, anexos (só referência), status, tags, campos personalizados, responsáveis, datas, dependências e horas registradas.
- Nada vai para as telas do TechProjects nesta etapa.

## Entrega 2 — Comparação e proposta (~1 dia)
- Casamento com o que existe, em ordem de confiança:
  1. Identificador do ClickUp já gravado pelo Clockify (a integração Clockify↔ClickUp costuma levar o id da tarefa) — vínculo automático.
  2. Mesmo cliente + nome de projeto/tarefa normalizado — sugestão.
  3. Nome parecido — só revisão manual, nunca automático.
- Pessoas: e-mail do ClickUp → membro do workspace; sem par, fica em revisão.
- Clientes: espaço/pasta de cliente → empresa existente (mesma regra: parecido = revisão).
- Organização proposta (tela de revisão com abas Vinculados / Sugeridos / Revisar / Novos / Ignorados):

```text
WK Technology (ClickUp)
  Diretoria          -> Espaço "Diretoria" (planos de ação, uso interno)
  Gestão             -> Espaço "Gestão Técnica" (planos de ação)
  Fábrica de Software-> Espaço "Fábrica de Software" (projetos por cliente)
  Consultoria        -> Espaço "Consultoria" (projetos por cliente)
  Outsourcing        -> Espaço "Outsourcing" (controles)
Demais workspaces (um por cliente de Outsourcing)
  -> pasta do cliente dentro de "Outsourcing", ligada à empresa,
     juntando-se ao projeto que já veio do Clockify quando houver par
```
- Horas do ClickUp não são importadas quando já existem no Clockify (o Clockify é a fonte das horas).

## Entrega 3 — Aplicação aprovada (~1 dia)
- Só depois do seu aceite, item a item ou em lote.
- Itens existentes recebem apenas o vínculo com o ClickUp e campos vazios preenchidos; nunca sobrescreve o que já foi editado no TechProjects.
- Novos itens levam a marca da execução, permitindo desfazer a importação inteira.
- Relatório final com contagens por tipo.

## Entrega 4 — Atualização contínua (opcional, ~0,5 dia)
- Reexecutar a leitura sob demanda para trazer novidades, com o mesmo controle anti-duplicação. Sincronização automática fica desligada até você pedir.

## Permissões
- Novas chaves: ver importação, executar leitura, aprovar/aplicar e desfazer, escopo workspace, sem concessão automática; testes de permitido, sem chave, negado, outro workspace e membro inativo.

## Riscos e dependências
- Exige que a conexão do ClickUp enxergue todos os workspaces citados.
- Volume grande pode exigir leitura em etapas (limite de requisições do ClickUp).
- Anexos ficam como link para o ClickUp, sem cópia de arquivos (posso incluir cópia depois, se quiser).

## Detalhes técnicos
- Tabelas novas de preparação e vínculo: `clickup_import_runs`, `clickup_staging_records`, `clickup_record_links` (CREATE → GRANT → RLS → POLICY), seguindo o padrão já usado em `clockify_*` e `contaazul_*`.
- Planejamento puro (`clickup-import-plan.ts` + reconciliação) testável, motor em `clickup-engine.server.ts`, chamadas finas em `clickup.functions.ts`.
- Destino: `project_spaces`, `project_folders`, `project_lists`, `projects`, `project_tasks`, `project_task_statuses`, `project_task_checklists`, `project_list_custom_fields`, `project_task_dependencies`, `project_members`.
- Validação: testes do planejador, `verify`, `build`, `permissions:check` e Playwright na tela de revisão.
