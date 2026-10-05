- Painel de vendas usa a origem principal do Lead e explicita a cobertura; nunca presume vínculos ambíguos.
- Ações manuais da timeline usam o gerenciador global autenticado para preservar janelas e rascunhos.
- Datas/horários de atividades usam seletores compartilhados, adaptadores local/ISO e passos de 15 min.
- Regras de Workflows ficam em src/lib/workflows/AGENTS.md.
- Arquétipos White Label são catálogos do workspace; trocam estilo, preservam identidade/assets e usam o `theme`.
- Grades `Table` usam barra horizontal espelhada no componente compartilhado, sem wrappers concorrentes.
- IA de chat passa por `aiChatFetch` (provedor do workspace, Lovable AI padrão, sem fallback; chaves cifradas no servidor).
- Grids: seleção página/global com os mesmos filtros e `SortableColumns` persistido por `gridKey`.
- Cada módulo abre com grupo "Visão geral" › "Dashboard"; listagens ficam em rotas próprias.
- Seis módulos verticais (crm, ats, people, contracts, projects, finance); `services` é id legado do TechContracts; UI usa `VERTICAL_MODULE_LIST`.
- Redesigns relevantes exigem mockup aprovado; a Inbox usa casco compartilhado que herda o White Label.
- Valores fixos seguem docs/architecture/hardcoded-values.md, barrados por src/lib/hardcode-guard.test.ts.
- `workspace_members.status` inactive tira acesso (is_workspace_member + banimento) mas preserva o nome — importa responsáveis HubSpot sem liberar acesso.
- Visibilidade restrita por cargo usa políticas RESTRITIVAS rep*scope*\* + job_roles.restricted_visibility; por quê: não altera cargos existentes e protege no banco.

- Conversões Cotação→Proposta→Contrato ficam em `src/lib/sales-flow.server.ts` com o cliente do usuário (RLS) e gravam a origem (`proposals.quote_id`, `contracts.proposal_id/quote_id`); por quê: rastreabilidade sem redigitar e sem duplicar.

- Propostas usam modelos próprios (`proposal_templates` + vínculo a serviços do catálogo), nunca cláusulas de contrato; o documento final (ficha, link público `/proposal/$token` e PDF) sai de `loadProposalDocument` e a edição é só pelo `ProposalWizard`; por quê: mesmo fluxo da cotação, uma única fonte para tela e PDF.

- "Ver como" usa sessão real do alvo após checar admin; pessoa opera com suas permissões. Papel de teste só grava em leads/companies/contacts/deals/activities: cada linha criada é registrada em `view_as_test_records` por gatilho, UPDATE/DELETE só em registros listados, vínculos a registros reais barrados, workflow*events/notifications suprimidos; registros de teste ficam ocultos fora da sessão de papel (`view_as_hide_test`); demais tabelas seguem bloqueadas por `view_as_ro*\*`+`is_read_only_view()`. A limpeza apaga pela lista (filhos→pais) e depois a conta; por quê: testar papéis sem contaminar dados reais.

- Identidade da Inbox é resolvida por workspace em serviço único, priorizando Contato sobre Lead e deixando duplicidades para escolha manual; por quê: impedir associação cruzada ou arbitrária entre carteiras e canais.
- Logotipos de empresas saem só de `CompanyAvatar` (manual em `companies.logo_url` como imagem reduzida → domínio/site → iniciais) e são carregados em lote por `useCompanyLogos`; por quê: uma fonte de verdade, sem consulta por linha e sem bucket público.
- Troca de tela mostra `ListPageSkeleton` (pendente padrão do roteador) e listagens pesadas são pré-carregadas no ocioso por `useIdleListPreload`; por quê: estrutura fixa aparece antes dos dados.
- Mensagens inbound notificam somente o responsável ativo no momento da entrada, com idempotência por canal/mensagem/usuário; por quê: evitar ruído e duplicidade entre provedores.
- Fichas comerciais usam `RecordLayout` opt-in com timeline central como mestre da rolagem proporcional lateral; por quê: painéis de alturas diferentes terminam juntos sem afetar telas ATS.
