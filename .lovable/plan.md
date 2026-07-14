## Problema

Na proposta gerada, os campos **Observações** e **Termos e condições** aparecem com o HTML cru (`<p class="p1"><b>...</b></p>`, `<br>`) em vez do texto formatado.

Causa: o `RichHtmlEditor` (usado no wizard e agora com suporte a snippets) salva `notes` / `terms` como HTML, mas o renderizador do template (`src/lib/quote-template-renderer.ts`) só emite HTML cru quando o template usa `{{{quote.notes}}}` (triple-brace). Templates antigos armazenados no banco usam `{{quote.notes}}` / `{{quote.terms}}` (double-brace), então o HTML é escapado e vira texto visível. Snippets amplificam o efeito porque colam HTML com atributos (`class="p1"`).

## Correção

Escopo mínimo, apenas no renderer — sem migrations, sem mexer no editor, sem mexer no wizard.

1. Em `src/lib/quote-template-renderer.ts`, dentro de `renderInterpolations`, tratar um conjunto fixo de campos rich-text como raw mesmo com double-brace:
   - `quote.notes`
   - `quote.terms`
   - `quote.description` (por segurança, se existir)
   - `company.description`, `contact.notes` (defensivo)
   Lista whitelisted, hardcoded — não afeta demais campos.
2. Não alterar o comportamento de `{{{...}}}` (continua raw) nem dos demais `{{...}}` (continuam escapados). Só a whitelist muda.
3. Manter o escape padrão para tudo mais (segurança contra injeção em campos como `quote.title`, `company.name`, etc.).

## Validação

- `tsgo` (typecheck).
- Abrir uma cotação existente com notes em HTML e verificar que a página pública `/quote/$token` renderiza o texto formatado.
- Verificar que campos não-rich (ex.: `quote.title`) continuam escapados — sem regressão de segurança.

## Fora de escopo

- Não sanitizar HTML no servidor (o conteúdo já vem do `RichHtmlEditor` do próprio workspace autenticado; sanitização mais forte fica para outra tarefa se necessário).
- Não migrar templates antigos no banco.
- Não alterar `src/routes/quote.$token.tsx` (fallback sem template) — pode ser tratado depois se o usuário quiser.
