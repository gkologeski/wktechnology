# Templates de plano (Fase 4)

Objetivo: reduzir o tempo de escrita/revisão de plano e conter o escopo crescente.

## Regra de escopo (obrigatória)

Um plano de **correção simples** (bug de UI, rótulo, badge, filtro, estado vazio)
**não pode** expandir para schema, RLS, permissões, autenticação ou regra de
negócio. Se a investigação mostrar que a correção exige isso, o plano para,
registra o achado e abre um plano novo do tipo `refactor` ou `feature`.

Bugs de UI acumulados entram em **um único plano semanal de polimento**, não um
documento por alteração.

## Template — bug

```text
# [bug] <sintoma observado>

## Reprodução
- rota / tela:
- passos:
- esperado vs obtido:

## Causa confirmada
(uma leitura de arquivo, query ou log que comprove; se não houver, primeiro
passo do plano é investigar)

## Correção
- arquivo(s):
- mudança:

## Fora de escopo
schema, RLS, permissões, regra de negócio, redesign.

## Validação
typecheck, lint, teste manual da rota afetada.
```

## Template — feature

```text
# [feature] <nome>

## Objetivo de produto
## Telas e rotas afetadas
## Dados (tabelas, campos novos, GRANT + RLS quando houver tabela nova)
## Permissões (chaves RBAC usadas)
## UX/UI (componentes oficiais, loading/empty/error, dark mode, responsivo)
## Fora de escopo
## Validação
```

## Template — refactor

```text
# [refactor] <alvo>

## Situação atual (medida)
linhas, imports estáticos, tempo de build/typecheck antes
## Mudança proposta (sem alteração de comportamento)
## Risco e plano de reversão
## Validação
typecheck, lint, test, build + smoke nas telas tocadas; comparar métricas
```
