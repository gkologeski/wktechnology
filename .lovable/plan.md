# Editor de cotação drag-and-drop

Substituir o editor de HTML cru por um construtor visual onde o usuário arrasta blocos (cabeçalho, dados do cliente, tabela de itens, totais, observações, termos, botões de ação, divisor, texto livre, imagem) para montar o modelo. O HTML continua sendo gerado por baixo, mantendo compatibilidade com o renderer atual (`{{quote.*}}`, `{{#each items}}`, `{{#actions/}}`) e com a página pública `/quote/$token`.

## Como vai funcionar para o usuário

- Em **Configurações → Modelos de cotação**, o editor abre em 3 colunas:
  - Esquerda: paleta de blocos arrastáveis.
  - Centro: canvas com pré-visualização real do modelo. Cada bloco pode ser reordenado (drag), selecionado, duplicado ou removido. Botão "Visualizar" mostra preview com dados de exemplo.
  - Direita: painel de propriedades do bloco selecionado (texto, alinhamento, cor, mostrar/ocultar campos, etc.) + propriedades globais (cor primária, fonte, espaçamento).
- Botão "HTML avançado" continua disponível para quem quiser editar o código (modo legado).
- Os 3 modelos sistema (Clássico/Moderno/Compacto) são reimportados como estruturas de blocos equivalentes.

## Blocos disponíveis

- **Cabeçalho**: título + número da cotação, alinhamento, cor de fundo opcional.
- **Logo**: imagem do workspace (branding) com tamanho ajustável.
- **Dados do cliente**: empresa, contato, e-mail.
- **Dados do emissor**: agente, e-mail, datas de emissão/validade.
- **Tabela de itens**: colunas configuráveis (nome, descrição, qtd, preço, desconto, imposto, total).
- **Totais**: subtotal, descontos, impostos, total (campos opcionais).
- **Observações** / **Termos**: blocos de texto livre vindos da cotação.
- **Texto livre**: parágrafo editável pelo usuário (com tokens `{{quote.x}}` autocomplete).
- **Botões de ação**: marcador `{{#actions/}}` (Aceitar/Recusar/Pagar).
- **Divisor**, **Espaçador**, **Imagem** (URL).

## Estrutura técnica

- Nova coluna `quote_templates.blocks JSONB` (default `null`). Quando preenchida, é a fonte de verdade; `html` é regenerado a partir dela no salvar. Modelos legados continuam funcionando com `html` puro.
- Novo módulo `src/lib/quote-template-blocks.ts`:
  - tipo `TemplateBlock = { id, type, props }` + `TemplateDocument = { blocks, theme }`;
  - `blocksToHtml(doc)` produz HTML compatível com o renderer atual (gera os mesmos `{{quote.*}}`/`{{#each items}}`/`{{#actions/}}`);
  - `seedBlocks.classic/modern/compact` (estruturas iniciais para os 3 modelos sistema).
- Editor novo `src/components/quote-templates/visual-editor.tsx` usando `@dnd-kit/core` + `@dnd-kit/sortable` (já leves, sem SSR issue):
  - paleta → canvas (drag de novo bloco);
  - reordenar dentro do canvas (sortable);
  - painel de propriedades por tipo.
- `template-editor.tsx` (atual) vira `code-editor.tsx` e fica acessível em uma aba "Avançado".
- Server functions (`createQuoteTemplate`/`updateQuoteTemplate`) aceitam `blocks` + `html`. Quando vier `blocks`, `html` é recomputado server-side via `blocksToHtml` para garantir consistência.
- Página pública `/quote/$token` não muda — continua consumindo `html` via `renderQuoteTemplate`.

## Migration

```sql
ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS blocks JSONB;
```

(Sem mudança de policies/grants.)

## Arquivos

Criar:
- `src/components/quote-templates/visual-editor.tsx`
- `src/components/quote-templates/block-palette.tsx`
- `src/components/quote-templates/block-canvas.tsx`
- `src/components/quote-templates/block-inspector.tsx`
- `src/components/quote-templates/blocks/*.tsx` (renderers por tipo)
- `src/lib/quote-template-blocks.ts`

Editar:
- `src/routes/_authenticated/settings.quote-templates.tsx` — abas Visual/Avançado, default Visual.
- `src/lib/quote-templates.functions.ts` — aceitar/persistir `blocks`, regenerar `html`.
- `src/integrations/supabase/types.ts` — campo `blocks` (auto).
- Migration nova.

Dependências:
- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

## Fora do escopo

- Reescrever a página pública da cotação.
- Editor WYSIWYG por bloco com formatação rica (apenas texto + props básicas nesta versão).
- Versionamento/histórico de modelos.
