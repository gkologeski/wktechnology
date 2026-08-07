# Contratos por cargo: agrupamentos, presets e sincronização com Pessoas

## 1. Agrupar contratos por Cargo e por Senioridade

Na lista `/contracts`, o alternador "Agrupar por" passa a ter quatro opções: Nenhum, Empresa, Serviço, **Cargo** e **Senioridade**.

- Cargo: um grupo por cargo do serviço do contrato (ex.: "Assistente Financeiro", "Desenvolvedor Full Stack"), com contagem e soma dos valores. Contratos sem cargo definido caem em "Sem cargo".
- Senioridade: grupos "Estágio, Júnior, Pleno, Sênior, Especialista, Coordenação, Gerência", na ordem hierárquica (não alfabética), mais "Sem senioridade".
- Contrato com mais de um serviço aparece em todos os grupos correspondentes, igual ao agrupamento por Serviço de hoje.
- No agrupamento por Cargo, o cabeçalho do grupo também mostra a prestadora quando o grupo tem uma única empresa, para dar a leitura "função + prestadora".
- A escolha continua persistida na URL e combina com os filtros de busca, tipo, status e responsável.

Os dados já vêm prontos do servidor (cargo e senioridade por serviço), então esta parte é só de interface.

## 2. Presets por tecnologia e perfil

Nova tela em Configurações → Catálogo: **Presets de contratação**.

Cada preset guarda um pacote pronto: nome (ex.: "Dev React Sênior"), linha de serviço do catálogo, cargo, senioridade, stack/competências, unidade, preço e custo sugeridos, moeda, observação e ativo/inativo. Tela no padrão das outras listas (cabeçalho, busca, filtro por linha de serviço, estados de carregando/vazio/erro, modal de criar/editar, exclusão com confirmação).

No modal "Associar serviço" do contrato entra um seletor **Preset** no topo. Ao escolher um preset, ele preenche linha de serviço, cargo, senioridade, stack e valores — tudo editável depois, sem travar nada. Presets inativos não aparecem no seletor.

Permissões reaproveitam as do catálogo de serviços (ver/criar/editar/excluir), como já acontece em Cargos e Perfis.

## 3. Sincronização com Pessoas (no momento certo do fluxo)

O fluxo real é: associa serviço ao contrato → assina → cria projeto → seleciona candidatos → contrata → **então** a pessoa existe. Portanto não há pessoa para ler no momento da associação; a sincronização acontece no sentido inverso, quando a pessoa é criada ou alocada:

- Ao criar uma alocação da pessoa em um contrato, cargo e senioridade são sugeridos a partir do serviço daquele contrato (cargo, senioridade e stack do preset/cargo escolhido). Campos ficam pré-preenchidos e editáveis.
- Se a pessoa está sem cargo (`role_title`) ou sem senioridade, esses campos do cadastro são preenchidos a partir da alocação — sem sobrescrever valores já informados.
- Quando o contrato tem mais de um serviço, o formulário mostra as opções para escolher qual cargo se aplica.

Nada é sobrescrito automaticamente e nenhuma pessoa é criada por esse caminho.

## Detalhes técnicos

- `contracts.index.tsx`: `validateSearch` aceita `job_profile` e `seniority`; `contracts-grouped-list.tsx` ganha os modos novos em `buildGroups` (ordem fixa para senioridade via `SENIORITY_OPTIONS`) e ícones próprios (`Briefcase` / `Layers`). `listContractGroupings` já retorna `jobProfileId`, `jobProfileName` e `seniority` — sem mudança de backend.
- Nova tabela `contracting_presets` (workspace-scoped, RLS + GRANTs no padrão do projeto): `name`, `service_catalog_id`, `job_profile_id`, `seniority`, `competencies text[]`, `unit`, `default_unit_price`, `default_unit_cost`, `currency`, `notes`, `active`.
- Novo `src/lib/contracting-presets.functions.ts` (CRUD + `listContractingPresetOptions`) espelhando `job-profiles.functions.ts`, e tela `src/routes/_authenticated/catalog.contracting-presets.tsx`; item no sidebar via `menu-config-core.ts` / `menu-resources.ts`.
- `link-catalog-service-dialog.tsx`: seletor de preset em Popover + Command (mesmo padrão do seletor de cargo) que apenas seta o estado local dos campos existentes; `services.functions.ts` não muda de contrato de dados.
- Alocações (`src/lib/people/allocations.functions.ts` + formulário da aba Alocação): nova leitura dos serviços do contrato para sugerir `role_title`/`seniority`; atualização de `people` só quando os campos estiverem vazios.
- Ordem de execução: (1) agrupamentos, (2) migration + tela de presets + seletor no modal, (3) sincronização em alocações.
