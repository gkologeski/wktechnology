# Base de prospecção: lista de contatos, multi-serviço e criação de fila

Hoje a aba **Base** (`/prospecting`, aba Base) mostra uma linha por cliente (empresa agregada), com um único serviço selecionável no combo e apenas ações de copiar/exportar. Não é possível trabalhar essa lista em fila.

## O que muda

**1. Lista focada em prospecção (formato da aba Fila)**

- Cada linha passa a ser uma **pessoa a prospectar** (contato), não um cliente agregado: nome, empresa, cargo, e-mail, telefone, responsável e último negócio.
- Visual no mesmo padrão da aba Fila: linhas com nome clicável, badges (serviço, resultado do negócio) e `AssigneeCell`.
- Além do contato principal do negócio, são incluídos os demais contatos das empresas encontradas, para que a lista tenha volume real de prospecção. Contatos sem e-mail e sem telefone aparecem marcados como "sem canal".
- Deduplicação por contato; a empresa aparece como informação secundária.
- Mantém busca, KPIs, Copiar nomes e Exportar CSV (CSV passa a exportar as colunas de contato).

**2. Combo de Serviços com seleção múltipla**

- O campo "Serviço" passa a aceitar vários serviços (mesmo componente de chips já usado no cadastro de filas), com "Todos os serviços" quando vazio.
- O filtro considera negócios que tenham **qualquer** um dos serviços escolhidos, e os chips do topo listam os serviços selecionados.

**3. Criar fila a partir da Base**

- Caixas de seleção por linha + "selecionar todos" e barra flutuante padrão do sistema com a contagem selecionada.
- Ação **"Criar fila de prospecção"**: abre um modal com nome da fila (pré-preenchido, ex. "Base · Ganhos · Fábrica de Software") e opção de adicionar a uma fila manual de contatos já existente.
- A fila criada é **manual, de contatos**, e aparece normalmente na aba Fila, podendo ser executada em "Iniciar fila".
- Botão respeita permissão de criar/editar fila (`techsales.prospecting.queue.create/update`); sem permissão, não é exibido.
- Estados: desabilitado sem seleção, "Criando…" durante a operação, toast de sucesso com nome/total e erro via toast.

**4. Tela de execução da fila passa a respeitar o tipo da fila**

Hoje `/prospecting/queues/$queueId/play` assume sempre "lead". Passa a usar o tipo da fila retornado pelo backend, para que filas de contatos abram o detalhe correto (`/contacts/$id`) e usem os rótulos de ciclo de vida. Nenhuma outra mudança no fluxo (questionário, qualificação, atalhos, timeline).

## Detalhes técnicos

- `src/components/prospecting/base-tab.tsx`: `serviceId: string` → `serviceIds: string[]` (filtro `.in("deal_line_items.service_catalog_id", ids)`); nova agregação por contato (query complementar em `contacts` pelas `company_id` encontradas, com projeção enxuta e limite); seleção via `Set<string>`; reuso de `AssigneeCell`, `EmptyState`, `FilterBar`, `MetricCard` e `AutocompleteChips`.
- Novo componente `src/components/prospecting/create-queue-from-base-dialog.tsx`, chamando `upsertQueue` (`kind: "manual"`, `entity: "contact"`, `item_ids`) e `addToQueue` para filas existentes; invalida `["prospecting","queues"]` e `["prospecting","queue-items"]`.
- `src/routes/_authenticated/prospecting.queues.$queueId.play.tsx`: `const entity = "lead" as const` → `itemsQ.data?.entity ?? "lead"` (o helper `statusLabel` e `detailTo` já tratam contato).
- Sem migration, sem mudança de schema, RLS, permissões ou regra de negócio. Leitura continua via cliente Supabase com RLS.
- Limite atual de 1.000 negócios por consulta é mantido, com aviso quando atingido.

## Validação

- `bun run typecheck` e `bunx eslint` nos arquivos alterados.
- Verificação no navegador: filtrar por dois serviços, selecionar contatos, criar fila, abrir a aba Fila e executar "Iniciar fila".
