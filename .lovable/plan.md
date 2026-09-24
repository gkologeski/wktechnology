# Design System em toda a área autenticada do TechERP

## Objetivo
Aplicar o padrão visual já consolidado em Negócios a toda a área autenticada: TechSales, TechHire, TechPeople, TechContracts, TechService, TechFinance, TechProjects, Core ERP, Configurações, Administração, Marketplace e Integrações.

A migração será exclusivamente de apresentação e experiência. Rotas, permissões, RLS, dados, integrações e regras de negócio serão preservados.

## Estratégia

### 1. Consolidar a fundação compartilhada
- Evoluir a fachada oficial em `@/components/techhire/ui` para cobrir os padrões recorrentes de lista, detalhe, formulário, dashboard, configurações e estados.
- Unificar cabeçalhos legados e específicos de módulo sobre `PageHeader` e as superfícies `ProductCanvas`, `ProductPageHeader`, `ProductToolbarBand`, `ProductTabsBand`, `ProductContent` e `ProductPanel`.
- Adaptar componentes compartilhados — tabelas, grids, kanbans, barras de filtros, painéis laterais, drawers, formulários e estados — antes de alterar cada rota, evitando duplicação.
- Manter o Destaque e todas as superfícies operacionais vinculados ao White Label, com pares claro/escuro e herança por módulo.
- Preservar fachadas e propriedades existentes quando forem usadas por muitas telas, migrando internamente sem quebrar chamadas.

### 2. Padronizar os tipos de tela
- **Listas:** cabeçalho contínuo, faixa de filtros/abas, painel de conteúdo, densidade operacional e estados loading/empty/error.
- **Detalhes:** cabeçalho compacto e áreas de propriedades, atividades e associações quando o domínio comportar esse modelo.
- **Dashboards:** KPIs com `MetricCard`, gráficos em painéis semânticos e hierarquia consistente.
- **Formulários e configurações:** `FormSection`, labels acessíveis, ações previsíveis e grupos sem cards aninhados.
- **Kanbans e split views:** manter drag-and-drop, seleção, atalhos e dimensões estáveis; mudar somente a composição visual.
- **Drawers, dialogs e sheets:** preservar fluxos e focos, uniformizando cabeçalhos, divisórias, rodapés e estados.

### 3. Rollout por ondas
1. **Base e Core ERP:** layout autenticado, componentes globais, dashboards, relatórios, tarefas, arquivos, reuniões, notas e comunicações.
2. **TechSales:** Leads, Contatos, Empresas, Prospecção, Catálogo, Propostas/Cotações, Campanhas, Inbox e demais telas CRM; Negócios permanece como referência e recebe apenas ajustes de compatibilidade.
3. **TechHire:** Vagas, Candidatos, Pipeline, Hunting, Sourcing, Entrevistas, Scorecards, Ofertas e analytics, preservando badges próprios do ATS.
4. **TechPeople e TechContracts:** Pessoas, times, onboarding, documentos, benefícios, alocações, bem-estar, contratos, modelos e configurações contratuais; visual de documentos permanece isolado do canvas operacional.
5. **TechFinance e TechProjects:** visão financeira, contas, bancos, NFS-e, recorrências, DRE, projetos, listas, tarefas, marcos e timesheet.
6. **TechService:** Chamados, quadro, split view, SLA, macros, base de conhecimento e chat, com validação específica de overflow e camadas.
7. **Administração e ecossistema:** todas as Configurações, Administração, Marketplace, Integrações, módulos, workspace e telas internas autenticadas restantes.

Cada onda será concluída e validada antes da seguinte, mas a entrega final só será considerada completa após o inventário registrar todas as rotas autenticadas.

## Regras visuais obrigatórias
- Usar exclusivamente tokens semânticos; remover cores fixas e variáveis legadas das superfícies migradas.
- Usar o Destaque do White Label apenas em ações, foco, seleção e ênfases; status preservam cores semânticas próprias.
- Suportar claro e escuro, desktop, tablet e celular sem sobreposição ou perda de densidade.
- Preservar textos em PT-BR, hierarquia compacta, foco visível, navegação por teclado e alvos de toque adequados.
- Não remover funcionalidades, ações, filtros, colunas, visualizações, `data-testid`, nomes acessíveis ou seletores usados por testes.

## Controle de cobertura
- Criar um inventário versionado de todas as rotas autenticadas, agrupadas por módulo e tipo de tela, com estado da migração e validação.
- Auditar usos de cabeçalhos legados, cores fixas, superfícies antigas, cards genéricos, estados incompletos e controles sem labels.
- Marcar uma rota como concluída somente quando estrutura, estados, responsividade, claro/escuro e fluxo principal estiverem verificados.
- Atualizar a documentação do Design System e o checklist para refletir os padrões globais e exceções justificadas.

## Validação
- Rodar typecheck, lint, testes unitários e de integração existentes e build de desenvolvimento.
- Executar os testes E2E relevantes por onda, preservando fluxos críticos e permissões.
- Validar visualmente rotas representativas e componentes compartilhados em 360, 768, 1024 e 1280 px, nos temas claro e escuro.
- Validar drag-and-drop, filtros, abas, drawers, dialogs, formulários, tabelas e estados loading/empty/error.
- Fazer auditoria final automatizada para confirmar cobertura integral das rotas autenticadas e ausência de regressões de tokens.

## Limites e segurança
- Sem migrations, alterações de banco, RLS, autenticação, permissões ou lógica de negócio.
- Sem redesenho das páginas públicas.
- Sem substituir bibliotecas ou arquitetura de rotas.
- Problemas funcionais preexistentes descobertos durante a migração serão documentados; só serão corrigidos quando forem regressões visuais simples ou bloquearem diretamente a aplicação do padrão.
