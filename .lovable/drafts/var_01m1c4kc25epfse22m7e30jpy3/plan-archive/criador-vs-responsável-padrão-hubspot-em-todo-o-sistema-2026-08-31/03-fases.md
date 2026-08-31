## Fases de implementação

### Fase 1 — Regra única no código (sem tocar no banco)

- Novo módulo `src/lib/entity/responsible.ts` com `responsibleId(record)` (`assigned_to ?? owner_id`) e `creatorId(record)` (`created_by ?? owner_id`).
- Substituir, nas telas que hoje chamam `owner_id` de "Responsável", a leitura pelo helper. Começa pelas entidades centrais: Negócios (quadro, lista, tabela, filtro), Leads, Contatos, Empresas, Atividades/Tarefas, Contratos, Projetos, Pessoas, Tickets.
- Onde a tela mostra o criador, passar a rotular explicitamente "Criado por" usando `creatorId`, para os dois conceitos deixarem de se confundir na interface.
- Filtros de responsável (`AssigneeFilter`, `OwnerFilter`) passam a filtrar por responsável efetivo, não por `owner_id` puro.

### Fase 2 — Consolidação de dados (migração aditiva + backfill)

- Backfill `assigned_to = coalesce(assigned_to, owner_id)` nas 57 tabelas que já têm as duas colunas (cobre os 55 leads, 39 contatos, 36 empresas e 63 atividades sem responsável).
- `assigned_user_id` deixa de ser fonte: os 153 leads divergentes são resolvidos gravando o valor mais recente em `assigned_to`, e a coluna passa a ser mantida apenas como espelho por gatilho, para não quebrar integrações e workflows que a leem hoje.
- Adicionar `assigned_to` às tabelas de negócio que ainda não têm (ex.: `tickets`), na mesma migração, com backfill a partir de `owner_id` e índice de filtragem. Tabelas de log, junção e configuração de plataforma ficam de fora.
- Gatilho para tornar `owner_id`/`created_by` imutáveis após a criação (criador não muda), e default `assigned_to = auth.uid()` na criação quando não informado.

### Fase 3 — Escopo de acesso coerente

- Hoje o escopo "próprio" do RBAC olha só `owner_id`. Passa a considerar **responsável ou criador** (`assigned_to = auth.uid() OR owner_id = auth.uid()`), via função `security definer` reutilizável — nenhuma política é afrouxada para outros usuários, e nenhuma coluna é renomeada.
- Aplicado progressivamente: primeiro as tabelas de CRM (leads, contatos, empresas, negócios, atividades), depois os outros módulos, para cada lote poder ser validado isoladamente.

### Fase 4 — Edição e auditoria

- Campo "Responsável" editável em detalhe, grid e edição em massa grava **só** `assigned_to` (o espelho é do banco), eliminando o padrão atual de gravar em dois lugares.
- Troca de responsável entra na timeline como alteração de propriedade, com rótulo e nome do usuário (nunca UUID).
- "Criado por" exibido como campo somente leitura no painel de propriedades.
