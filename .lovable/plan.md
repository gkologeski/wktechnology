# Corrigir erro ao editar item de linha

## O que está acontecendo

Ao aplicar/limpar o preset de contratação em um item de linha, a tela tenta gravar um
campo que não existe na tabela de itens — o nome do preset. Esse nome é apenas um
rótulo vindo do cadastro de presets, usado para exibição, e não uma informação
gravada no item. Resultado: a gravação falha com "Could not find the 'preset_name'
column".

Confirmado na estrutura da tabela: o preset escolhido **é** gravado, na coluna
`contracting_preset_id` (junto com cargo, senioridade, unidade e forma de cobrança que
o preset preenche). O que não existe como coluna é `preset_name` (e também
`service_name` / `job_profile_name`) — esses são apenas rótulos lidos dos cadastros
relacionados na hora de exibir. Hoje a tela envia o rótulo junto com a gravação, e é
isso que quebra a operação inteira — inclusive impedindo que o vínculo do preset seja
salvo.

## O que será feito

1. Separar claramente, no editor de itens de linha, o que é campo gravável do que é
   rótulo de exibição. Somente campos graváveis vão para o banco; os rótulos
   continuam aparecendo na tela imediatamente, como hoje.
2. Aplicar a mesma separação nos três caminhos que gravam: alteração de campo,
   inclusão de item e desfazer (tanto desfazer de alteração quanto recriação de item
   excluído, que hoje reenviaria os mesmos rótulos).
3. Sem mudança de comportamento visível além do erro desaparecer: o nome do preset
   continua sendo mostrado ao lado do item, o autosave continua igual e nada de
   valores, descontos, impostos ou totais muda.

## Detalhes técnicos

- Em `src/components/deals/use-line-items.ts`, adicionar uma lista das colunas
  realmente persistíveis de `deal_line_items` e um helper `persistableFields(patch)`
  que descarta as chaves derivadas (`service_name`, `preset_name`,
  `job_profile_name`, além de joins `service`/`preset`).
- Usar o helper em `persistUpdate` (antes do `.update()`), em `insertRow` (antes do
  `.insert()`) e no ramo de recriação do `undo` (que espalha `entry.row` completo).
- O cache otimista (`setItemsCache`) continua recebendo o patch completo, para que o
  rótulo do preset apareça na hora.
- `src/components/deals/line-item-card.tsx` permanece como está: ele já é a origem
  correta do rótulo; a filtragem fica na camada de persistência, o que também protege
  outros chamadores (ex.: wizard de cotação que reutiliza o mesmo editor).

## Validação

- Teste unitário para o helper de filtragem (campo derivado descartado, campos
  graváveis preservados).
- `bunx vitest run`, `bunx eslint` nos arquivos alterados, `bunx tsgo --noEmit`.
- Validação manual: abrir os itens de linha do negócio, aplicar e remover um preset,
  alterar quantidade/preço e confirmar "Tudo salvo" sem erro; recarregar a página e
  conferir que os dados persistiram.
