# Auditoria e correção de quebras de layout responsivo

## Diagnóstico confirmado (caso da captura)

`src/components/ai/ai-summary-panel.tsx` monta o cabeçalho como
`CardHeader className="flex flex-row items-center justify-between"` com dois
`SelectTrigger` de largura fixa (`w-[150px]` e `w-[100px]`) mais o botão "Gerar",
sem `flex-wrap`, sem `min-w-0` no título e sem `shrink-0` nos controles.

O painel vive na coluna central do `RecordLayout`
(`src/components/record/record-layout.tsx`), que em `xl` usa
`grid-cols-[260px_minmax(0,1fr)_300px]`. No viewport atual (1338px) a coluna
central fica com ~380px, menos que a soma dos controles (~150+100+90+gaps), então
a linha transborda e o botão "Gerar" sai da borda do card, aparecendo por baixo do
card de Empresa. É exatamente o padrão anti-responsivo descrito no guia de layout:
linha com texto + widgets de tamanho fixo sem grid encolhível.

Esse mesmo padrão (`flex ... justify-between` + largura fixa, sem `flex-wrap`/
`min-w-0`/`shrink-0`) aparece em ~104 componentes, então a correção precisa ser
sistemática e não pontual.

## O que será feito

### 1. Correção imediata do caso reportado

- `ai-summary-panel.tsx`: cabeçalho passa a `flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`, título com `min-w-0`, grupo de controles com `flex-wrap` + `shrink-0` e selects com largura fluida (`w-full sm:w-[150px]`, `min-w-0`).

### 2. Varredura automatizada de quebras

Script Playwright (em `/tmp`, não versionado) que percorre as rotas autenticadas
e públicas principais em 360, 768, 1024, 1280 e 1440px e reporta, por tela:

- elementos com `scrollWidth > clientWidth` (transbordo horizontal);
- elementos cujo retângulo ultrapassa a largura do contêiner pai/viewport;
- botões/labels visivelmente cortados ou sobrepostos.

O resultado gera a lista priorizada de telas a corrigir (evita "achismo" e
garante cobertura real do sistema).

### 3. Correções por padrão, não por tela isolada

Para cada ocorrência apontada pela varredura, aplicar os padrões já vigentes no
projeto:

- linhas de cabeçalho: `grid grid-cols-[minmax(0,1fr)_auto]` no mobile, `flex` a partir de `sm`;
- `min-w-0` em todo contêiner flex/grid que contém texto; `truncate` em títulos de uma linha;
- `shrink-0` em ícones, avatares e botões de ação;
- larguras fixas (`w-[Npx]`) trocadas por `w-full sm:w-[Npx]` em toolbars e filtros;
- tabelas densas dentro de wrapper com rolagem horizontal própria, em vez de esticar a página;
- troca de `h-screen` por `h-dvh` onde ainda existir.

Prioridade: telas de detalhe (lead, contato, empresa, negócio, contrato, projeto,
vaga), toolbars/FilterBar de listas, painéis laterais de associações, builders
(workflow, sequência, cotação) e modais largos.

### 4. Validação

- `tsgo --noEmit` e `bun run lint`;
- re-execução da varredura Playwright confirmando zero transbordos nas telas corrigidas;
- checagem visual em light e dark nos breakpoints 360/768/1024/1280.

## Detalhes técnicos

- Alterações restritas a classes de layout em componentes de apresentação e rotas; nenhuma mudança de dados, queries, RLS, permissões ou regra de negócio.
- Apenas utilitários Tailwind e tokens semânticos já usados no projeto; nada de cor ou tamanho avulso.
- Nenhuma funcionalidade, ação ou `data-testid` removido — o objetivo é preservar comportamento e apenas impedir quebra visual.
- Como a base tem ~100 arquivos com o padrão de risco, a execução será por fases (detalhe → listas → builders → modais), com revisão e validação ao final de cada fase.
