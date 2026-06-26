## Diagnóstico

Na timeline do negócio, ao renderizar uma atividade do tipo `meeting` (`src/components/activity-timeline.tsx`), há dois problemas visuais:

1. **Caixa vazia logo abaixo do cabeçalho "Reunião"**
   O bloco de metadados (linhas ~1310–1412) renderiza o wrapper `<div class="mt-2 ... border ... bg-muted/30 p-3">` sempre que `a.type === "meeting"`, mesmo quando todos os filhos (`startD`, `joinLink`/`loc`, `attendees`, `accessLink`, `recordingUrl`) são vazios. Nesse caso aparece um retângulo branco/cinza vazio com a aparência de um `<input>`, exatamente como no screenshot.

2. **Corpo da reunião renderizado sem hierarquia (parede de texto sem marcadores, sem espaçamento entre parágrafos)**
   `HtmlContent` (`src/components/rich-html-editor.tsx`) aplica classes `prose prose-sm ...` do plugin `@tailwindcss/typography`. O pacote não está instalado nem registrado em `src/styles.css`, então em Tailwind v4 as classes `prose-*` viram no-op. Como o Preflight zera `list-style` de `ul/ol` e margens de `p`, listas e parágrafos do HTML salvo aparecem colados, sem marcadores e sem respiro — exatamente o efeito visto.

Escopo: somente UI/apresentação na timeline. Sem mexer em dados, RLS, server functions, schema ou regras de negócio.

## Mudanças

### 1. `src/components/activity-timeline.tsx` — esconder caixa vazia da reunião

Dentro do bloco `a.type === "meeting" && (() => { ... })()`, calcular após as variáveis derivadas:

```ts
const hasMeetingMeta =
  !!startD || !!joinLink || !!loc ||
  (meta.attendees && meta.attendees.length > 0) ||
  !!accessLink || !!recordingUrl;
if (!hasMeetingMeta) return null;
```

Assim o wrapper `<div class="mt-2 space-y-2 rounded-lg border ...">` só renderiza quando há ao menos um campo. Nenhum outro comportamento muda.

### 2. Estilização do conteúdo HTML salvo (notas, e-mails, descrições)

Não introduzir dependência nova. Adicionar regras locais em `src/styles.css` (dentro de uma `@layer components`) que dão a `HtmlContent` o mínimo de tipografia esperada — espaçamento de parágrafo, listas com marcador, headings, citações, links e código — usando apenas tokens semânticos já existentes (`--foreground`, `--muted-foreground`, `--primary`, `--border`).

Resumo dos seletores adicionados (escopados em `.prose`):

- `p` com `margin-block`;
- `ul` com `list-disc` + `padding-inline-start`;
- `ol` com `list-decimal` + `padding-inline-start`;
- `li` com `margin-block` pequeno;
- `h1/h2/h3` com pesos/tamanhos;
- `a` com cor `--primary` e `text-decoration: underline`;
- `blockquote` com borda lateral via `--border`;
- `code`/`pre` com fundo `--muted` e fonte monoespaçada;
- `strong`/`em` mantidos.

Isso resolve todos os usos de `HtmlContent` (notas, e-mails, reuniões), sem dependência de plugin. As classes utilitárias já no componente (`prose-p:my-1`, etc.) continuam inofensivas.

## Verificação manual

1. Abrir o negócio do contato `ignacio.celedon@arquimidia.com` → conferir que a caixa vazia sumiu para reuniões sem metadados e que reuniões com link/participantes continuam exibindo o bloco normal.
2. No corpo da mesma reunião, confirmar que as bullet lists agora aparecem com marcadores e respiro entre linhas.
3. Verificar uma nota antiga e um e-mail registrado para garantir que a tipografia melhorou em todos os usos de `HtmlContent`.
4. Validar light/dark mode.

## Fora de escopo

- Não instalar `@tailwindcss/typography` (evita dependência só por estilização básica).
- Não alterar o editor `RichHtmlEditor`, sanitização, schema, RLS ou server functions.
- Não tocar nos blocos de `call`, `email`, anexos ou rodapé de ações.
