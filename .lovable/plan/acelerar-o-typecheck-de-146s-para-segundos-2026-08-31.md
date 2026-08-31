# Acelerar o typecheck (de ~146s para segundos)

## O que foi medido agora (fatos, não estimativa)

| Comando | Tempo real medido |
| --- | --- |
| `tsc --noEmit` (cache vazio) | **2m25s** |
| `tsc --noEmit` (segunda execução, cache quente) | **6s** |
| `tsgo --noEmit` | **25s** |

Diagnóstico confirmado:

1. O `package.json` já usa `tsgo --noEmit` no script `typecheck` (25s). Os 180s vêm de execuções de `tsc` com **cache frio**.
2. O `tsconfig.json` já tem `incremental: true`, mas o arquivo de cache aponta para `node_modules/.cache/tsbuildinfo/app.tsbuildinfo`. Antes da medição a pasta estava **vazia** — ou seja, o cache é perdido a cada reinstalação de dependências, e todo ambiente novo paga os 2m25s.
3. Entrada gigante: `src/integrations/supabase/types.ts` com **20.672 linhas** e `src/routeTree.gen.ts` com **8.516**, dentro de 1.377 arquivos TS/TSX.
4. Build (`vite build`) não roda typecheck próprio — o custo é só dos scripts de verificação.

## O que fazer

### Fase 1 — Cache que sobrevive a reinstalação (ganho principal)

- Mover `tsBuildInfoFile` de `node_modules/.cache/tsbuildinfo/app.tsbuildinfo` para `.tscache/app.tsbuildinfo` na raiz, e adicionar `.tscache/` ao `.gitignore` e `.prettierignore`.
- Efeito: `bun install` deixa de apagar o cache; a verificação incremental passa a custar os ~6s medidos, em vez de 2m25s.

### Fase 2 — Padronizar qual comando é usado

- `typecheck` continua `tsgo --noEmit` (25s, sem cache necessário) — é o comando para CI e checagem limpa.
- Adicionar `typecheck:inc` = `tsc --noEmit --incremental` como comando de laço curto durante desenvolvimento (~6s com cache quente).
- `typecheck:tsc` permanece como referência de validação cruzada.
- Documentar em `CLAUDE.md` (seção Comandos) qual usar em cada situação, substituindo a nota atual de "lento; ~30s+".

### Fase 3 — Encurtar o caminho crítico do smoke

- Adicionar script `verify` que roda `typecheck` e `lint` em paralelo e depois `test`, em vez de encadear tudo em série. Hoje cada etapa é chamada isoladamente e o tempo total soma.
- Nenhuma regra de lint, teste ou tipo é afrouxada; só a ordem de execução muda.

### Fase 4 — Reduzir volume (opcional, medir antes de manter)

- Medir com `--extendedDiagnostics` quanto de tempo vem de `src/integrations/supabase/types.ts`.
- Se dominar, avaliar `types.ts` mais enxuto por domínio, mantendo o arquivo gerado intacto (nunca editado à mão) — só ajustando quais tabelas o app referencia via helpers já existentes de projeção.
- Só aplicar se a medição mostrar ganho real; caso contrário, manter como está.

## Fora de escopo

- Alterar `tsconfig` em regras de tipo (`strict`, `skipLibCheck` etc.).
- Editar arquivos gerados (`types.ts`, `routeTree.gen.ts`).
- Mudanças em RLS, schema, autenticação, regra de negócio ou UI.

## Detalhes técnicos

- Arquivos tocados: `tsconfig.json`, `.gitignore`, `.prettierignore`, `package.json` (scripts), `CLAUDE.md` (documentação).
- Validação: rodar `bun run typecheck`, `bun run typecheck:inc` duas vezes (frio e quente), `bun run lint`, `bun run test` e `bun run build`, registrando os tempos para comparar com a baseline acima.

## Expectativa realista

O laço de verificação cai de ~2m25s para ~6s quando há cache, e para 25s sem cache. O build de produção não muda com este trabalho — ele já não depende do typecheck.
