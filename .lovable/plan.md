# Abrir telas pesadas com a estrutura imediata (Contatos, Empresas e demais listagens)

## Objetivo
Ao clicar em uma tela do menu, o usuário vê na hora o cabeçalho, abas de visualização, busca, filtros, botões de ação e o "esqueleto" da tabela. Só a área de registros espera os dados.

## Situação atual (verificada no código)
- Contatos e Empresas não têm carregamento de rota: toda a espera acontece dentro da tela.
- A tela só aparece depois que o código dela (arquivos com ~1.100 linhas) termina de baixar; enquanto isso, a tela anterior fica parada, sem sinal de troca. Não há tela de transição configurada no roteador.
- A lista de registros só começa a buscar depois que a preferência de colunas do usuário termina de carregar (duas esperas em sequência).
- Ao mudar filtro/aba/página, a tabela volta ao estado "carregando" em vez de manter os dados anteriores até chegarem os novos.

## O que será feito
1. **Transição imediata entre telas**: tela de transição padrão no roteador (cabeçalho + barra de filtros + linhas-esqueleto), exibida após ~150 ms se o código da nova tela ainda não chegou. Vale para todas as telas autenticadas.
2. **Pré-carregamento do código das telas principais** do menu do módulo ativo quando o navegador estiver ocioso (além do atual "ao passar o mouse").
3. **Contatos e Empresas — estrutura fixa nunca espera dados**: cabeçalho, abas, busca, painel de filtros e ações renderizam sempre; contador mostra "Carregando…"; só o corpo da tabela usa esqueleto fiel ao layout.
4. **Buscar dados sem esperar a preferência de colunas**: iniciar a lista com as colunas padrão em paralelo à preferência, sem trocar ordenação/colunas salvas do usuário (ajuste aplicado assim que a preferência chegar).
5. **Manter dados anteriores ao filtrar/paginar**, com indicador discreto de atualização, em vez de esvaziar a tabela.
6. Aplicar o mesmo padrão às demais listagens que usam a mesma grade (Leads, Negócios, Candidatos etc.), sem mudar funcionalidades.

## Fora do escopo
Sem mudança em banco, permissões ou regras; sem redesign visual.

## Detalhes técnicos
- `src/router.tsx`: `defaultPendingComponent` (componente `ListPageSkeleton` em `components/techhire/ui`), `defaultPendingMs: 150`, `defaultPendingMinMs: 200`.
- Preload ocioso: `requestIdleCallback` + `router.preloadRoute` para itens do menu ativo (`menu-config*`).
- `useGridProjection`: expor colunas padrão síncronas; remover `enabled: !projection.isLoading` onde a projeção padrão for suficiente, com chave de query estável para evitar busca dupla.
- `placeholderData: keepPreviousData` nas queries de lista; `isFetching` para indicador.
- Validação: medir com Playwright o tempo até filtros visíveis vs. registros visíveis antes/depois em /contacts e /companies (desktop, mobile, escuro); typecheck, lint dos arquivos, testes e build.
