# Padronizar todos os grids pelo modelo de Empresas e Contatos

## Referência única
Empresas e Contatos definem a aparência e o comportamento de todas as listas:
- filtros no painel lateral esquerdo (recolhível), com o mesmo visual;
- abas de visões no topo e visões salvas;
- barra única com busca, colunas, modos de exibição e exportação;
- chips dos filtros aplicados;
- tabela com cabeçalho ordenável, colunas arrastáveis e salvas por usuário;
- paginação e contagem vindas do servidor;
- seleção da página e "Selecionar todos os N registros" do resultado filtrado;
- barra flutuante de ações em massa (editar, atribuir, atividade, exportar, excluir, conforme permissões);
- estados de carregamento, vazio e erro iguais.

Os grids deixam de montar filtros, barras e seleção por conta própria: passam a declarar só a entidade, os campos e as ações exclusivas do domínio.

## Já feito nesta etapa
- Empresas e Contatos: "Selecionar todos os registros" agora percorre todas as páginas com os mesmos filtros.
- Projetos, Tarefas de projeto e Serviços: seleção global passou a respeitar busca, status, tipo e responsável.
- Auditoria atualizada com as lacunas reais de cada tela.

## Etapas
1. Extrair o "casco" de Empresas/Contatos em um componente comum (painel lateral, visões, barra, chips, tabela, paginação, seleção), sem alterar essas duas telas visualmente.
2. Migrar Leads e Negócios para o casco, preservando Pipeline e os modos de exibição.
3. Tickets: aplicar o mesmo casco (sem mockup alternativo, já que o visual segue Empresas/Contatos), mantendo Tabela, Quadro, Split, SLA e pipeline.
4. Fase 4: Projetos, Tarefas de projeto, Serviços e Contratos no casco, preservando Kanban e ações próprias.
5. Demais módulos em lotes: TechHire, TechPeople, TechFinance, Comunicações/Notas, Campanhas/Modelos.
6. Cada lote validado no navegador: filtros laterais, visões, ordenação, colunas, paginação, seleção global, ações em massa e exportação.

## Exceções
Somente ações genuínas de domínio (ex.: gerar contrato, mover etapa, SLA) ficam específicas da tela; listas administrativas curtas podem dispensar ações em massa, com justificativa na auditoria.

## Detalhes técnicos
- Base: `hubspot-shell` (FiltersSidebar, ViewsTabs), `useGridColumns` + `SortableColumns`, `useGridSelection` (buildIdQuery ou loadAllIds), `BulkActionBar`/`GridBulkBar`, `saved_views`, `user_grid_preferences`.
- Telas que hoje filtram no navegador (Negócios até 1.000, Tickets até 500, Projetos/Serviços) passam a filtrar e paginar no servidor via server functions com a mesma validação e RBAC atuais.
- Sem mudança de banco, RLS ou regras de negócio.
- Validação: typecheck, lint, testes e verificação no navegador por lote.
