# Apagar os 4 testes criados na correção de permissões

## O que será feito

Remover os quatro arquivos de teste criados hoje (12/10) durante a correção das
permissões da WK. Nada mais é alterado.

| Arquivo | Casos de teste |
| --- | --- |
| `src/lib/access-control/access-admin-guard.server.test.ts` | 5 |
| `src/lib/access-control/effective-origins.test.ts` | 6 |
| `src/lib/access-control/restore-default-keys.test.ts` | 4 |
| `src/lib/access-control/role-set-resolution.test.ts` | 5 |

Total: 20 casos de teste removidos.

## O que continua no projeto

- Os módulos de produção testados por eles ficam intactos:
  `access-admin-guard.server.ts`, `effective-origins.ts` / `.server.ts` /
  `.functions.ts`, `restore-default-keys.ts`, `role-set-resolution.ts` /
  `.server.ts`. A regra de negócio e as correções aplicadas não mudam.
- Os scripts de prova da stack isolada (`rbac-wk-phase1/5/6.ts`,
  `run-rbac-phase5/6.sh`) continuam no projeto.
- Os testes de ciclos anteriores (caixa de entrada, desempenho, tempo real,
  etc.) continuam no projeto.
- A documentação `docs/architecture/rbac-wk-review-2026-10.md` permanece como
  está, incluindo as citações dessas provas — por sua opção de manter o
  histórico. Consequência: o documento passará a citar um arquivo de teste que
  não existe mais no repositório.

## Como será verificado

1. Conferir que nenhum outro arquivo importa esses testes (já confirmado agora:
   nenhuma importação; são arquivos folha).
2. Rodar `bun run verify` completo (tipos, lint e testes).
   - Esperado: nenhum erro de tipo ou lint e todos os testes restantes
     verdes, com cerca de 773 testes (793 menos os 20 removidos).
3. O build não será executado: nenhum módulo de produção é tocado, apenas
   arquivos de teste. Se o `verify` mostrar qualquer problema, isso é
   corrigido antes de encerrar.

## Segurança e reversão

- Nenhum arquivo de código, migração, banco de dados ou publicação é tocado.
- Os quatro arquivos já estão registrados no histórico do repositório
  (commit `b501f16e5`), então a recuperação é possível a qualquer momento.

## Técnico

- Exclusão via `rm` dos 4 caminhos listados.
- `vitest.config.ts` usa `include: ["src/**/*.test.ts"]`, sem lista explícita
  de arquivos — nenhuma configuração precisa mudar.
- `scripts/isolated-db/view-as.vitest.config.mjs` aponta para
  `mac-view-as.test.ts`, que fica no projeto: não é afetado.
