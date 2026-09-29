# Dashboards por módulo e Visão geral no topo

Padronizar o acesso inicial de **TechSales, TechHire, TechContracts, TechProjects, TechFinance, TechPeople e TechERP**: cada contexto terá o quadro **“Visão geral”** no topo do menu, com o primeiro item chamado **“Dashboard”**. O TechServices fica fora deste escopo.

## Estrutura de navegação

- **TechSales:** manter `/dashboard`, mover “Dashboard” para um novo primeiro grupo “Visão geral” e retirar o item “Painel” da posição atual em “Otimizar”.
- **TechHire:** manter `/ats-dashboard`; apenas preservar/padronizar o grupo e o item já existentes.
- **TechContracts:** criar `/contracts/dashboard`; manter `/contracts` como lista de contratos e torná-la o segundo grupo/item operacional.
- **TechProjects:** criar `/projects/dashboard`; manter `/projects` como lista de projetos e “My Work” como área operacional.
- **TechFinance:** manter `/finance`; separar o item atual em um primeiro grupo “Visão geral” e renomeá-lo para “Dashboard”.
- **TechPeople:** criar `/people/dashboard`; manter `/people` como lista de pessoas.
- **TechERP:** manter `/home`, cujo painel consolidado já existe; renomear o item “Home” para “Dashboard” dentro do primeiro grupo “Visão geral”.
- Atualizar as rotas iniciais de Contracts, Projects e People para seus novos dashboards, sem quebrar os endereços atuais das listagens.
- Ajustar a composição do menu para o grupo “Visão geral” aparecer antes dos cadastros compartilhados do Core ERP.

## Novos painéis

### TechContracts
- Indicadores: contratos ativos, valor contratado ativo, contratos em aprovação/assinatura e vencimentos próximos.
- Blocos: distribuição por status, próximos vencimentos/renovações, contratos que exigem atenção e contratos recentes.
- Cada indicador e linha terá acesso à listagem ou ao contrato correspondente.

### TechProjects
- Indicadores: projetos ativos, progresso médio, tarefas abertas/atrasadas e horas apontadas no período.
- Blocos: saúde dos projetos, tarefas que exigem atenção, horas por situação e projetos com prazo próximo ou vencido.
- Respeitar as permissões existentes: métricas gerenciais aparecem somente no escopo que o usuário pode visualizar; usuários restritos veem apenas informações próprias permitidas.

### TechPeople
- Reutilizar a apuração existente de Analytics para headcount, alocações, custos, receita e margem, evitando duplicar fórmulas.
- Indicadores: pessoas ativas, alocações ativas, utilização/alocação e margem.
- Blocos: composição do time, documentos a vencer, onboarding/offboarding em andamento e alertas de pessoas.
- Indicadores sensíveis de custo e margem continuam restritos pelas permissões atuais.

## Padronização dos painéis existentes

- Manter as regras e indicadores atuais de TechSales, TechHire, TechFinance e TechERP.
- Ajustar somente inconsistências necessárias ao padrão: `PageHeader`, `MetricCard`, filtros, skeleton fiel, estado vazio, erro recuperável e ações de atualização/drill-down.
- Completar metadados próprios de todas as rotas de dashboard: título, descrição, Open Graph e Twitter Card.
- Usar PT-BR, tokens semânticos, light/dark mode e layouts responsivos.

## Detalhes técnicos

- Criar funções de leitura autenticadas e finas para Contracts e Projects, com agregadores server-only separados; para People, compor a partir da função analítica existente quando ela já fornecer a mesma regra.
- Consultas continuam sob RLS/RBAC e `workspace_id`; não usar acesso privilegiado nem ampliar visibilidade.
- Filtros de período ficam em parâmetros compartilháveis quando a métrica depende de data; indicadores de estado atual permanecem explicitamente identificados como atuais.
- Reutilizar `PageHeader`, `SectionHeader`, `MetricCard`, `EmptyState`, skeletons, badges e gráficos compartilhados. Componentes de apresentação não acessam o banco.
- Adicionar testes de integridade dos menus, rotas iniciais, cálculos puros dos indicadores e regras de visibilidade.

## Validação

- Testar cada Dashboard pelos seletores de módulo e pelo primeiro item do menu.
- Confirmar carregamento, vazio, erro/repetir, filtros, links de detalhe e restrições por permissão.
- Conferir desktop, tablet e celular, temas claro/escuro e navegação por teclado.
- Executar formatação, lint, typecheck, testes unitários, build e smoke tests autenticados dos sete painéis.

## Banco e escopo preservado

- Sem migration, novas tabelas, alteração de schema, RLS, automações ou regras de negócio.
- Listagens e funcionalidades atuais permanecem disponíveis nos mesmos endereços.
- TechServices não recebe dashboard nesta entrega.
