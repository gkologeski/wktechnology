# Combo de serviços no contrato deve abrir/fechar

## Problema

No modal "Associar serviço ao contrato", a lista de serviços do catálogo é renderizada sempre visível abaixo do campo de busca (uma lista fixa com rolagem), não como um seletor. Resultado: parece um combo permanentemente aberto, empurra o resto do formulário para baixo e não fecha após escolher o serviço.

## O que muda

Transformar o campo "Serviço do catálogo" em um seletor de busca real:

- Um botão-gatilho que mostra o serviço escolhido (nome, código, tipo e preço base) ou o placeholder "Buscar serviço do catálogo".
- Ao clicar, abre um painel de busca com a lista filtrável; ao escolher um item, o painel fecha e o preço unitário continua sendo preenchido a partir do preço base, como hoje.
- Estados preservados: carregando, erro com "Tentar novamente", vazio com atalho para abrir o catálogo.
- Acessibilidade: label associado, foco visível, navegação por teclado e item selecionado marcado.
- Sem alteração de regra de negócio, schema, permissões ou dos demais campos comerciais do modal.

## Detalhes técnicos

- Arquivo: `src/components/services/link-catalog-service-dialog.tsx`.
- Substituir o bloco `Input` + `div role="listbox"` por `Popover` + `Command` (componentes oficiais já usados no projeto), no padrão dos outros pickers de busca do app.
- Manter `listCatalogServiceOptions` via `useQuery` e a função `pick()` inalteradas; o filtro passa a ser feito pelo `Command` (ou mantido em `useMemo`, conforme o padrão vigente dos pickers).
- `Popover` dentro de `Dialog`: usar `modal` no popover para não perder o foco do modal.
- Validação: `tsgo` e `eslint --fix` nos arquivos alterados.
