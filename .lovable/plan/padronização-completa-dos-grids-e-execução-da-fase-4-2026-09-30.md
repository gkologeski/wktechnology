# Padronização completa dos grids e execução da Fase 4

## Diagnóstico confirmado

- **Empresas seleciona somente a página atual.** A barra recebe apenas a contagem selecionada; não recebe o total filtrado nem a ação global. O componente compartilhado já suporta “Selecionar todos os N registros”, e Leads já utiliza esse recurso.
- **A seleção global existe, mas não está padronizada.** Também aparece em `EntityList`, Contratos e Tarefas; Empresas, Contatos, Negócios e Tickets não a conectam de forma uniforme.
- **Tickets está em uma família paralela de grid:** colunas fixas, filtros superiores e laterais sobrepostos, consulta limitada a 500 itens, ordenação/filtro no navegador e sem paginação real. Isso diverge do padrão com projeção de colunas, filtros no servidor e preferências por usuário.
- **Negócios também diverge:** filtros superiores e carregamento limitado a 1.000 itens para processamento no navegador.
- A varredura inicial encontrou grids operacionais em todos os módulos e diversas listas administrativas. O inventário atual de 17 telas não representa todo o sistema e será substituído por uma matriz completa, incluindo componentes filhos.

## Padrão único obrigatório

Todo grid operacional usará a mesma base e oferecerá, quando a permissão e a natureza da entidade permitirem:

1. busca e filtros em **painel lateral**, com etiquetas dos filtros ativos;
2. visões salvas, visão padrão e compartilhamento no workspace;
3. ordenação por coluna e paginação no servidor com total real;
4. checkbox por linha e no cabeçalho para a página atual;
5. ação explícita **“Selecionar todos os N registros”**, sempre respeitando busca, visão e filtros ativos em todas as páginas;
6. barra flutuante única com limpar seleção, atribuir responsável, editar em massa, criar atividade/tarefa, exportar selecionados e excluir, conforme RBAC e aplicabilidade;
7. editor de colunas com mostrar/ocultar, arrastar, restaurar padrão e persistência por usuário/grid;
8. campos personalizados disponíveis automaticamente como colunas, filtros e edição em massa quando o catálogo da entidade permitir;
9. exportação do resultado filtrado completo, não apenas das linhas carregadas;
10. ações por linha, estados loading/empty/error, acessibilidade, responsividade e dark mode;
11. Kanban somente para entidades com etapa/status compatível, compartilhando filtros, seleção e ações com a tabela.

Não haverá uma implementação artesanal de “campos integrados por tela”. Colunas, filtros, ordenação, exportação e edição em massa serão derivados do **catálogo/metadados da entidade**. Cada domínio declarará apenas exceções legítimas, como renderização, rótulo, ação exclusiva, campo não editável ou etapa de Kanban; não escolherá manualmente quais funções básicas o grid terá.

## Execução

### Etapa 0 — Inventário definitivo e contrato de conformidade

- Varrer todas as rotas autenticadas e seus componentes filhos, incluindo grids em abas e páginas de detalhe.
- Classificar cada ocorrência como grid operacional, relatório analítico, lista embutida ou lista administrativa curta.
- Publicar uma matriz por rota com presença/ausência de cada item do padrão, fonte dos dados, limite atual e componente usado.
- Definir testes de conformidade para impedir novos grids fora da base compartilhada.
- Manter listas administrativas curtas fora da migração completa somente quando paginação, seleção e ações em massa não fizerem sentido; ainda assim preservar busca, ordenação e estados quando aplicáveis.

### Etapa 1 — Fundação compartilhada

- Extrair um `DataGrid` e controladores compartilhados para consulta, filtros, busca, ordenação, paginação, colunas, views, seleção e exportação.
- Reutilizar `BulkActionBar`, `useGridColumns`, `SortableColumns`, catálogo de campos, edição em massa dinâmica, filtros de responsável/período, visões salvas e guardas RBAC já existentes.
- Remover a duplicação de seleção existente nas rotas e tornar `totalMatching` + seleção global parte obrigatória do contrato do grid paginado.
- Buscar IDs de todos os resultados filtrados em lotes, com limite de segurança, progresso, cancelamento e mensagem clara quando o limite for atingido.
- Fazer consultas e contagens no servidor; nenhum resultado pode desaparecer por limites silenciosos de 500/1.000 linhas.

### Etapa 2 — Correção imediata das referências centrais

- **Empresas:** adicionar “Selecionar todos os N registros” usando a mesma consulta da lista e todos os filtros ativos; aplicar a seleção global a todas as ações em massa.
- **Contatos e Leads:** garantir paridade integral e eliminar implementações duplicadas; preservar funções atuais.
- **Negócios:** migrar filtros superiores para o painel lateral padrão, manter seletor de pipeline e modos Tabela/Quadro/Lista/Previsão, e trocar o limite local por paginação/contagem reais.
- Validar essas referências antes de migrar outros módulos.

### Etapa 3 — Tickets como prova completa do padrão

- Criar mockup renderizado de Tickets no padrão único, com tabela, painel lateral, visões, seleção global, barra em massa e alternância Tabela/Quadro/Split; obter aprovação visual antes do código.
- Migrar Tickets sem remover pipeline, SLA, foco, Quadro ou Split.
- Eliminar filtros duplicados/integrados e o limite silencioso de 500 itens.
- Adicionar colunas configuráveis/reordenáveis, paginação real, seleção global e todas as ações em massa aplicáveis.
- Usar Tickets como teste de aceitação da fundação antes da expansão.

### Etapa 4 — Execução da Fase 4 solicitada

A Fase 4 será executada como padronização funcional, e não apenas como ajustes isolados:

- concluir seleção de todos os resultados em todos os grids operacionais;
- completar seleção múltipla, atribuição, edição em massa dinâmica, criação de atividade/tarefa, exportação de selecionados e exclusão protegida onde aplicável;
- concluir mostrar/ocultar e drag-and-drop de colunas, com persistência por usuário e grid;
- migrar **Projetos, Tarefas de projeto, Serviços e Contratos** para a fundação comum, preservando seus Kanbans, fluxos e ações específicas;
- incluir na mesma fase os grids identificados na auditoria que já possuem seleção parcial, para não deixar comportamentos híbridos.

### Etapa 5 — Migração por módulos

Após a prova em Tickets e a Fase 4:

1. **TechHire:** Candidatos, Vagas, Ofertas e demais grids operacionais.
2. **TechPeople:** Pessoas, Benefícios, Documentos, Incidentes, Onboarding, Offboarding, Meu time, Faturamento, Margem, Psicossocial e Timesheet.
3. **TechFinance:** Lançamentos, Faturas, NFS-e, Recorrências, Contas bancárias, Conciliação e Auditoria.
4. **Core/TechSales/TechContracts:** Campanhas, Comunicações, Notas, Modelos, Tickets e demais listas operacionais encontradas.

Cada lote só avança após validar que não perdeu ações específicas nem alterou regras de negócio.

## Segurança e dados

- Preservar schema, RLS, isolamento por workspace e regras de negócio; qualquer índice necessário será proposto separadamente com medição.
- Leituras e mutações protegidas continuam autenticadas e sob RBAC/RLS.
- Exclusões usam confirmação por contagem e verificação da quantidade realmente afetada.
- A seleção global guarda IDs, não carrega registros completos; exportação completa será produzida por consulta paginada segura.
- Ações não aplicáveis ou não autorizadas não serão exibidas como disponíveis.

## Validação e aceite

- Testes unitários da consulta/filtro e seleção global, incluindo múltiplas páginas, busca, filtros combinados, visão salva, limite e seleção parcial.
- Testes de conformidade para garantir que todo grid operacional use a fundação e exponha o conjunto obrigatório.
- Testes de integração das ações em massa com resultado total/parcial negado por permissão.
- Verificação visual e funcional em desktop, tablet e celular; light/dark; teclado e leitor de tela.
- Fluxo manual por grid: filtrar → selecionar página → selecionar todos os N → executar cada ação permitida → limpar seleção → recarregar preferências.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build:dev` e E2E dos fluxos críticos ao final de cada lote.
- Atualizar `docs/qa/grid-feature-audit.md` com a matriz completa e marcar cada tela somente após validação real.

## Fora de escopo

- Alterar regras de negócio, permissões concedidas, automações ou conteúdo dos registros.
- Forçar recursos sem sentido em relatórios somente leitura ou listas administrativas curtas; essas exceções deverão estar justificadas na matriz.
