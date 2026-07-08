## Problemas observados no painel direito do Workflow Builder

Ao selecionar um passo (ex.: `create_activity`, `create_deal`), o painel direito (`aside` em `workflow-builder.tsx`, largura fixa `sm:w-96` = 384px) renderiza `ExtraFieldsEditor`. Dentro dele há quatro problemas ligados ao layout e à UX de tokens:

1. Cada linha de campo usa `grid grid-cols-[1fr_1.5fr_auto]` — em 384px de painel menos padding sobra ~340px, dos quais 1fr (~130px) fica para label e 1.5fr (~195px) para o input. Isso empurra inputs para a direita e faz FKs sumirem. Precisa empilhar (label em cima, input full width).
2. Abaixo do `<Label>` há um `<p class="truncate">{key} · {type}</p>` mostrando o nome técnico do campo (ex.: `owner_id · uuid`). O usuário quer só o label amigável.
3. `TokenInput` / `TokenTextarea` só oferecem inserção de token via botão discreto `{ }` que abre popover — os tokens não ficam visíveis como pills. O padrão desejado é `TokenPills` renderizado sempre abaixo do input.
4. Em `FkPicker` (campo empresa/contato/usuário/pipeline) o combobox e um `TokenInput` de largura fixa `w-32` dividem a linha em `grid-cols-[1fr_auto]`. Dentro dos 195px da coluna, o `TokenInput` fica cortado/sobreposto ao combobox.

Fora de escopo: alterar RLS, catálogo de campos, server functions de busca (`searchCompanies`, `searchContacts`, etc.), tokens do catálogo e comportamento do builder fora do painel de detalhes.

## Correções propostas

### 1. Alargar e reorganizar o painel direito
Arquivo: `src/components/workflows/workflow-builder.tsx` (linha ~636)
- Trocar `sm:w-96 ... max-w-96` por `sm:w-[28rem] lg:w-[32rem] max-w-full` para dar respiro ao formulário sem quebrar o layout do canvas.

### 2. Empilhar linhas do `ExtraFieldsEditor` e remover subtítulo técnico
Arquivo: `src/components/workflows/extra-fields-editor.tsx` (linhas 489–521)
- Substituir `grid grid-cols-[1fr_1.5fr_auto]` por layout empilhado: header com Label + botão remover à direita (flex justify-between), e input em bloco full-width abaixo.
- Remover o `<p>{key} · {type}</p>` — mostrar somente `field.label ?? key`.
- Manter o botão `Trash2` como `ghost/icon` alinhado ao topo direito da linha.

### 3. TokenPills sempre visíveis nos campos de texto
Arquivo: `src/components/workflows/token-input.tsx`
- Remover o botão `{ }` (`TokenButton`) e o `pr-8`.
- Renderizar `<TokenPills tokens={tokens} onInsert={...} label="" className="mt-1" />` logo abaixo do `<Input>` / `<Textarea>`.
- Manter API atual (`value`, `onValueChange`, `tokens`, `pickerLabel` continua aceito porém ignorado ou usado como aria-label do bloco de pills). Inserção continua via `insertAtCursor`.
- Efeito colateral: `CustomFieldsEditor` (usa `TokenInput` inline em grid) e `FkPicker` (usa `TokenInput` inline com `w-32`) passarão a mostrar pills embaixo. No `FkPicker` a mudança é resolvida no item 4; no `CustomFieldsEditor` as pills aparecendo abaixo do valor são desejáveis e não quebram o layout de pares.

### 4. `FkPicker` sem TokenInput lateral
Arquivo: `src/components/workflows/extra-fields-editor.tsx` (linhas 273–400)
- Trocar o grid `grid-cols-[1fr_auto]` por layout empilhado: combobox full-width no topo; abaixo, um botão texto discreto "Usar token…" que alterna para um `TokenInput` full-width (linha abaixo, também full-width) quando o usuário quer inserir `{{token}}`.
- Se `value` já for um token (`isToken`), abrir automaticamente no modo TokenInput; caso contrário, modo combobox.
- Preservar comportamento: seleção via combobox grava o `id`; token gravado sobrescreve o id.

## Validação

- `bunx tsgo --noEmit`
- Conferência visual manual: abrir Workflows → Novo → configurar step `create_deal` e `create_activity`; validar (a) painel mais largo, (b) label sem `{key}·{type}`, (c) TokenPills visíveis abaixo dos inputs, (d) campo `company_id` sem sobreposição — combobox e alternador de token empilhados.

## Detalhes técnicos

- Nenhuma alteração de dados, RLS, catálogo ou server functions.
- `TokenPills` já existe (`src/components/ui/token-pills.tsx`) e recebe `tokens` + `onInsert` — o mesmo `insertAtCursor(el, current, text, setValue)` já usado hoje.
- Nenhuma quebra de contrato do `TokenInput`/`TokenTextarea`: props seguem iguais, apenas o layout muda.
- Ícone `Braces` deixa de ser usado — remover import.
