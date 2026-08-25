# Corrigir perda de foco ao digitar nos campos do workflow

## Sintoma

Em `/settings/workflows`, ao configurar um passo e começar a digitar em um campo de texto, o cursor sai do campo após o primeiro caractere.

## Causa (confirmada por leitura do código)

Em `src/components/workflows/extra-fields-editor.tsx`, os campos são separados em dois blocos diferentes da árvore:

- `filled` — campos com valor (renderizados em um container)
- `empty` — campos vazios (renderizados dentro do bloco recolhível "Outros campos")

```text
antes de digitar:   [Outros campos] -> Título (vazio)
após 1º caractere:  [Preenchidos]   -> Título ("A")
```

Como o campo muda de container pai, o React desmonta o input antigo e monta um novo. O input recém-montado não tem foco, então a digitação para no primeiro caractere. O mesmo vale para o bloco "Campos do sistema e integrações".

## Correção

Congelar o bloco (bucket) de cada campo enquanto o painel estiver aberto, em vez de recalcular a cada tecla:

- Guardar, por campo, o bloco em que ele apareceu pela primeira vez (preenchido / vazio / sistema) em uma ref.
- Ao digitar, o campo permanece exatamente na mesma posição da árvore — sem remontagem e sem perda de foco.
- Reavaliar os blocos apenas quando muda a entidade/tabela alvo, quando o painel é reaberto ou quando o catálogo de campos é recarregado.
- Manter o comportamento atual de contadores, validações, campos "pinned" e o botão de limpar.

## Detalhes técnicos

- Arquivo: `src/components/workflows/extra-fields-editor.tsx`
- Substituir o cálculo direto de `filled` / `empty` por uma atribuição estável de bucket (ref + `useEffect` de sincronização), mantendo `hasValue`/`pinned` apenas para rótulos e contagem.
- Nenhuma mudança em schema, RLS, server functions ou regras de negócio; a alteração é de renderização.

## Validação

- `bunx tsc`/typecheck e lint do projeto.
- Teste manual: abrir um workflow, adicionar passo "Criar contrato", digitar em "Título" e confirmar que o texto completo é digitado sem perder o foco; repetir em um campo do bloco de sistema e em um campo já preenchido.
