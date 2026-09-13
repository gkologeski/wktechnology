# Formatar a nota de envio de formulário na timeline do lead

## Diagnóstico (confirmado)

Em `src/routes/api/public/forms/$slug.submit.ts`, o corpo da atividade é montado como texto puro com quebras de linha (`filled.join("\n")`). Porém a timeline (`src/components/activity/activity-timeline-item.tsx`) renderiza o corpo como **HTML** via `HtmlContent` (DOMPurify), onde `\n` não gera quebra visual — resultado: todos os campos saem concatenados num parágrafo só, como no print.

## O que fazer

1. **Montar o corpo da nota como HTML estruturado** em `src/routes/api/public/forms/$slug.submit.ts`:
   - Cada campo do formulário vira uma linha própria: `<p><strong>Rótulo:</strong> valor</p>`.
   - A nota "Nome informado no envio" continua como primeira linha destacada quando o nome divergir do cadastro.
   - **Escapar HTML** dos valores vindos do visitante (função `escapeHtml` local) antes de inserir no corpo — evita injeção de marcação; DOMPurify já sanitiza na exibição, mas o escape na origem é a camada correta.
   - Tags usadas (`p`, `strong`, `em`, `br`) já constam na lista permitida do sanitizador (`src/components/rich-html-editor.tsx`), então nada é removido na renderização.

2. **Notas legadas**: manter como estão (não migrar histórico). Se desejado, um ajuste de exibição (renderizar `\n` como quebra quando o corpo não contém tags HTML) pode ser feito depois em `activity-timeline-item.tsx` — fora do escopo mínimo.

## Validação

- `bun run typecheck` e lint do arquivo alterado.
- Teste: submeter o formulário público com vários campos e conferir no banco/timeline que cada campo aparece em linha própria (screenshot).

## Riscos

- Nenhum impacto em envios anteriores; apenas novas notas passam a sair formatadas.
