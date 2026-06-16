## Objetivo

Em `/proposals/$id`, hoje o corpo é editado com um `RichHtmlEditor` minimalista (negrito, itálico, lista, link, código). Vou substituir por um editor WYSIWYG completo, parecido com o Microsoft Word, mantendo o restante da página intacto (variáveis, cláusulas, aprovações, envio, selo de imutabilidade, pré‑visualização).

## Stack escolhida

**TipTap v2** (headless, baseado em ProseMirror) — padrão moderno de mercado para editores WYSIWYG em React. Vantagens: extensível, sanitização confiável, ótima UX, suporte nativo a tabelas/imagens/colaboração futura.

Pacotes a instalar:
- `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`
- `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-text-align`
- `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`
- `@tiptap/extension-font-family`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`
- `@tiptap/extension-image`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-placeholder`, `@tiptap/extension-subscript`, `@tiptap/extension-superscript`

## O que será feito

1. **Novo componente** `src/components/word-editor.tsx`:
   - Editor TipTap com toolbar estilo Word organizada em grupos:
     - Família de fonte + tamanho (presets) + cor de texto + cor de destaque
     - Negrito / Itálico / Sublinhado / Tachado / Sub / Sobrescrito
     - Títulos H1–H4 + parágrafo + bloco de citação + código
     - Listas: marcadores, numerada, tarefas, recuar/diminuir recuo
     - Alinhamento: esquerda / centro / direita / justificar
     - Inserir: link, imagem (por URL), tabela (com adicionar/remover linha/coluna), linha horizontal, quebra de página
     - Desfazer / Refazer / Limpar formatação
   - Saída em HTML sanitizada com `DOMPurify` (reaproveitando `sanitizeHtml` existente, expandindo a allowlist para incluir `table`, `thead`, `tbody`, `tr`, `th`, `td`, `img`, `hr`, `mark`, `sub`, `sup`, atributos `colspan`/`rowspan`/`align`/`src`/`alt`/`width`).
   - Suporte a inserção de texto externo via prop `insertHtml` (usado pelas variáveis `{{...}}` e pela biblioteca de cláusulas).
   - Estilo CSS dedicado (paleta semântica do design system) — sem cores cruas.

2. **Atualizar `src/routes/_authenticated/proposals.$id.tsx`**:
   - Trocar `RichHtmlEditor` por `WordEditor` no corpo da proposta.
   - Botões de variáveis e cláusulas passam a chamar `editorRef.current?.insertHtml(...)` em vez de concatenar string em `setBody`.
   - Manter `sanitizeHtml` na renderização travada (`locked`) e na pré‑visualização.

3. **Atualizar `src/components/rich-html-editor.tsx`**:
   - Apenas estender `SANITIZE_CONFIG` para aceitar as tags/atributos novos (tabela, imagem, hr, mark, sub, sup, colspan, rowspan, align, src, alt, width, height, style restrita).
   - Não altero o `RichHtmlEditor` em si — outros lugares continuam usando.

4. **Sem mudanças** em rotas, server functions, schema do banco ou na coluna `body` (continua HTML string).

## Detalhes técnicos

- SSR: TipTap é client-only; usarei `useEditor` dentro do componente, que já é renderizado dentro de um route component cliente — sem `useEffect` para hidratação extra. Caso surja qualquer aviso de mismatch, envolvo o editor em um `Suspense`/render condicional após `useState(true)` no `useEffect`.
- Acessibilidade: toolbar com `aria-label`, atalhos padrão (Ctrl+B/I/U, Ctrl+Z, Ctrl+Shift+7/8 etc. já vêm do StarterKit).
- Sanitização defensiva: sempre passar `editor.getHTML()` por `sanitizeHtml` antes de salvar.
- Tema: o conteúdo herda o CSS prose já existente; adiciono uma folha de estilos local para tabelas (bordas) e foco do editor.

## Fora do escopo (posso fazer depois se quiser)

- Upload real de imagens para storage (por enquanto, imagem por URL ou base64 colada).
- Comentários/colaboração em tempo real (TipTap Collab).
- Exportar `.docx` da proposta (precisaria de conversor HTML→DOCX no servidor).
- Substituir o `RichHtmlEditor` em outros lugares (notas, e-mails, comentários) — só troco em /proposals.
