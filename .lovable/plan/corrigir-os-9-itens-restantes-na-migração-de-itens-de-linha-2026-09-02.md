# Corrigir os 9 itens restantes na migração de itens de linha

## Diagnóstico (verificado no banco)

Restam **13 itens** em 10 nomes distintos sem `service_catalog_id`. Consultando os
nomes crus, **9 desses nomes têm espaço em branco no fim** (ex.: `"Fábrica de
Software  "`, `"Tech Lead "`, `"Desenvolvedor Full Stack Pleno "`). Apenas
`"Desconto de Projeto em Execução"` não tem espaço extra.

Causa: a tela agrupa por nome **já com `trim()`** (`listUnmappedLineItemNames`),
mas a aplicação faz `update ... .eq("name", entry.name)` com esse nome aparado.
Como no banco o valor tem espaço no fim, o `eq` não casa nenhuma linha: o lote é
reportado como aplicado com 0 atualizações e os itens continuam sem serviço.

`"Desconto de Projeto em Execução"` é caso diferente: é uma linha de desconto,
não um serviço — não tem (nem deve ter) sugestão automática.

## Proposta

### 1. Casar pelos nomes reais, não pelo nome aparado

- `listUnmappedLineItemNames` passa a devolver, junto de cada grupo, a lista de
  **variantes cruas** do nome encontradas no banco (com espaços, maiúsculas
  originais etc.), mantendo o rótulo aparado só para exibição.
- `applyLineItemMapping` recebe essas variantes e atualiza com
  `.in("name", variantes)` em vez de `.eq("name", nomeAparado)`, continuando
  condicionado a `service_catalog_id is null`.
- Compatibilidade: quando a entrada não trouxer variantes, o comportamento atual
  (`eq`) é mantido, então nada quebra.

### 2. Feedback honesto na tela

Depois de aplicar, se um grupo aprovado resultar em 0 linhas atualizadas, a tela
mostra aviso por nome ("nenhum item atualizado") em vez de sumir silenciosamente
com o grupo. Hoje o retorno soma tudo e não permite ver o que falhou.

### 3. Linhas que não são serviço

Adicionar, na própria tela, a opção de marcar o grupo como **"Não é serviço"**,
que apenas o oculta da lista de pendências (preferência local, sem gravar em
banco), para casos como `"Desconto de Projeto em Execução"`.

## O que NÃO muda

- Nenhuma migração, coluna nova, `DROP`, RLS, GRANT ou permissão.
- Nenhum valor financeiro (`quantity`, `unit_price`, desconto, imposto).
- Nenhum nome de item é reescrito/aparado no banco.
- Nenhum item já classificado é sobrescrito.

## Detalhes técnicos

- `src/lib/catalog/line-item-migration.functions.ts`: `UnmappedGroup` ganha
  `rawNames: string[]`; `mappingEntry` ganha `rawNames` opcional; o update usa
  `.in("name", rawNames ?? [name])` e o retorno passa a incluir
  `results: Array<{ name: string; updated: number }>`.
- `src/components/catalog/line-item-migration-page.tsx`: envia `rawNames`,
  exibe o resultado por grupo e trata a ação "Não é serviço" (estado local).
- Validações previstas: `bun run typecheck:inc`, `bun run lint` nos arquivos
  alterados, `bun run test` e conferência por consulta do `count` de itens sem
  serviço antes/depois (13 → 1 esperado).

## Como validar manualmente

1. Abrir `/catalog/line-item-migration`: 10 nomes, 13 itens.
2. Aprovar os 9 com sugestão e aplicar: a tela deve reportar itens atualizados
   por nome e a lista cair para 1 pendência.
3. Marcar `"Desconto de Projeto em Execução"` como "Não é serviço": a lista fica
   vazia, sem alterar dados.
