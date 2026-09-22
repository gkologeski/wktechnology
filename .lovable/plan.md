# Preset de contratação com busca digitada (igual ao campo Empresa)

## Problema

No item de linha do negócio, "Preset de contratação" é uma lista simples: carrega até 100 presets do serviço escolhido e não permite digitar para filtrar. Com centenas de presets por serviço (ex.: 253 em Outsourcing de TI), encontrar "Desenvolvedor Java Senior" exige rolar a lista, e presets além do limite podem nem aparecer.

## O que muda

O campo passa a se comportar como o campo Empresa:

- Botão-gatilho mostrando o preset escolhido (nome + cargo/senioridade/unidade) ou "Sem preset".
- Ao abrir, um campo de busca: o usuário digita e a consulta é feita online, com espera curta entre teclas, trazendo presets do serviço da linha que combinem com o texto (nome ou código).
- Opção "Sem preset" para limpar; item selecionado marcado; estados de carregando, vazio e erro.
- Ao escolher, o painel fecha e o preenchimento de cargo, senioridade, unidade e valor continua exatamente como hoje.
- Acessibilidade e teclado: rótulo associado, foco visível, navegação por setas, Enter para escolher.
- Nenhuma mudança de regra de negócio, schema, permissões ou dos demais campos do item.

## Detalhes técnicos

- `src/lib/contracting-presets.functions.ts`: adicionar `search?: string` ao input de `listPresetsForService` e aplicar `.or(name.ilike,code.ilike)` quando presente (mesmo padrão de `listContractingPresetOptions`); manter `service_catalog_id` + `active` e o limite. Permissões e middleware inalterados.
- `src/components/catalog/preset-line-picker.tsx`: trocar `Select` por `Popover` + `Command` (`shouldFilter={false}`), no padrão de `bulk-ref-picker.tsx`; busca com debounce de ~200 ms, `useQuery` com chave `["contracting_presets","for-service",serviceCatalogId,q]`, `enabled` quando aberto, `placeholderData: (prev) => prev`.
- Consulta separada para rotular o preset já selecionado quando ele não estiver na página atual de resultados (buscar por id via a lista do serviço ou manter o último item escolhido em estado).
- `usePresetsForService` continua exportado (usado para decidir se o campo aparece); manter a regra atual de esconder o campo quando o serviço não tem presets.
- Sem alteração em `line-item-card.tsx` além do que o componente já expõe (`onApply` inalterado).
- Validação: `bun run typecheck`, `bun run lint` nos arquivos alterados, `bun run test`.
