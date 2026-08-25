# Badge de pendências + paginação e filtros avançados em Contratos

## 1. Badge de pendências no botão "Vincular contratos"

Em `/contracts`, o botão **Vincular contratos** passa a exibir uma badge com o total de contratos pendentes de vínculo manual (prestação sem compra + compra sem prestação, ignorando os dispensados da fila).

- A badge só aparece quando a contagem for maior que zero.
- Estilo destacado (variante de alerta) e texto acessível: `aria-label` do botão informa "Vincular contratos, N pendentes".
- Contagens acima de 99 exibem "99+".
- A contagem é buscada por uma consulta leve e dedicada (não reaproveita a lista completa da fila), com cache curto e revalidação após importar em lote ou vincular/dispensar um contrato.
- A mesma contagem aparece no título da página `/contracts/links`, para dar continuidade visual.

## 2. Paginação no servidor na grid de /contracts

A grid passa a carregar somente a página atual no banco, com total real de registros.

- Rodapé com: "Exibindo X–Y de Z contratos", navegação anterior/próxima, ir para primeira/última página e seletor de itens por página (25, 50, 100, 200 — padrão 50).
- Página e tamanho de página ficam na URL (parâmetros de busca), então o estado sobrevive a recarregar e voltar da tela de detalhe.
- Qualquer mudança de filtro, busca ou ordenação volta para a página 1.
- A seleção múltipla passa a ser por página: ao trocar de página a seleção da página anterior é mantida e a barra de ações em lote mostra o total selecionado; um botão "Limpar seleção" continua disponível.
- Agrupamentos (Empresa, Serviço, Cargo, Senioridade) e "Aninhar aditivos" continuam funcionando, agrupando os registros da página atual. Um aviso curto informa que o agrupamento considera a página exibida.
- Estados de carregando (esqueleto fiel à tabela), vazio (sem contratos) e "nenhum resultado para os filtros" ficam distintos — hoje o vazio é o mesmo nos dois casos.

Como os filtros agora precisam valer para a base inteira (e não só para o que já foi carregado), **busca, tipo, status e responsável passam a ser aplicados no servidor**, junto com os novos filtros.

## 3. Filtros avançados

Além de busca, tipo, status, responsável e agrupamento já existentes:

**Empresa (contraparte) e contratante**

- Seletor com busca por empresa contraparte.
- Seletor de contratante (entidade legal do próprio grupo). Quando o contrato veio de importação e o contratante só existe como texto extraído do documento, o filtro também considera esse texto, para não esconder contratos importados.

**Período de vigência**

- Início entre datas e término entre datas, com seletor de período em pt-BR.
- Atalhos: "Vencendo em 30 dias", "60 dias", "90 dias", "Vigentes hoje" e "Já encerrados".

**Comportamento comum aos filtros**

- Todos os filtros ficam na URL, permitindo compartilhar um link já filtrado.
- Uma barra de "filtros ativos" mostra chips removíveis individualmente e um botão "Limpar filtros".
- Os filtros avançados ficam recolhidos atrás de um botão "Filtros" com contador, para não poluir a barra principal.

## Detalhes técnicos

- `listContracts` (`src/lib/contracts.functions.ts`) ganha parâmetros opcionais adicionais: `offset`, `assignedTo`, `contractingLegalEntityId`, `startsFrom/startsTo`, `endsFrom/endsTo`, `documentKind` e um modo paginado que retorna `{ rows, total }` usando `count: "exact"` + `.range()`. O retorno atual em array é preservado quando o modo paginado não é solicitado, para não quebrar os demais chamadores (detalhe de contrato, pickers, fila de vínculo, negócios).
- Nova server function `countContractsPendingLink` em `src/lib/contracts/import.functions.ts`, reaproveitando a mesma regra de pendência já implementada em `listContractsPendingLink` (extraída para um helper compartilhado para evitar divergência entre a lista e a contagem).
- Filtro por contratante combina `contracting_legal_entity_id` e o texto em `metadata.contracting_name_extracted`.
- Na rota `src/routes/_authenticated/contracts.index.tsx`: `validateSearch` passa a validar todos os filtros + `page`/`pageSize` (usando `fallback` do adaptador Zod, sem enums fechados nem limites que resetem valores silenciosamente); leitura via `Route.useSearch()` e escrita via `navigate({ search: prev => ... })`.
- O filtro de responsável deixa de usar `filterRows` em memória e passa a enviar `assigned_to` (incluindo os casos "sem responsável" e "eu") ao servidor; o componente `AssigneeFilter` é reutilizado como está.
- Rodapé de paginação construído com o componente `ui/pagination` já presente no projeto; seletor de datas seguindo o padrão pt-BR do projeto.
- `ContractsTable` e `ContractsGroupedList` continuam recebendo apenas as linhas da página — sem mudança na assinatura além do que for necessário para o aviso de agrupamento.
- Nenhuma alteração de schema, RLS, permissões ou regra de negócio. Sem migration.

## Riscos e limites

- Agrupamento e "aninhar aditivos" operam sobre a página atual; um aditivo cuja principal esteja em outra página aparece como linha própria. O aviso na tela deixa isso explícito.
- Contagem exata (`count: "exact"`) em bases muito grandes é mais custosa; se houver lentidão perceptível, o passo seguinte é trocar por contagem estimada.

## Como validar manualmente

1. Em `/contracts`, com contratos importados sem par, confirmar a badge numérica no botão "Vincular contratos"; vincular ou dispensar um item em `/contracts/links` e ver a badge diminuir.
2. Navegar entre páginas e alterar itens por página; confirmar o texto "Exibindo X–Y de Z" e que a URL guarda página/tamanho.
3. Aplicar filtros de empresa, contratante e vigência; confirmar que o total muda, que os chips aparecem e que "Limpar filtros" restaura a lista.
4. Filtrar por responsável e confirmar que o total reflete a base inteira, não só a página.
5. Selecionar itens em duas páginas diferentes e confirmar que a barra de ações em lote soma corretamente.
6. Validar tela em desktop/tablet/mobile e nos modos claro e escuro.
