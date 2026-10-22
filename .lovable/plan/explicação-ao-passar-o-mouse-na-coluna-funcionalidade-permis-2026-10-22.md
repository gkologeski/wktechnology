# Explicação ao passar o mouse na coluna Funcionalidade (Permissões)

Porte P · estimativa 30–45 min.

## O que muda
Na matriz de `/settings/permissions`, ao passar o mouse (ou focar com teclado) sobre a funcionalidade de uma linha (Exibir, Criar, Editar, Excluir, Exportar, Aprovar, Atribuir, Acesso total), aparece um balão com um texto curto explicando o que ela libera naquele recurso.

Exemplo para "Atividades › Editar":
"Permite alterar atividades. O escopo escolhido define quais: as próprias, as da equipe ou todas do workspace."

Para "Acesso total" o texto avisa que inclui editar e excluir registros de outros usuários (substitui o aviso atual do ícone, mantendo o ícone).

## Regras do texto
- Gerado a partir da ação + nome do recurso, em PT-BR, uma ou duas frases.
- Ações com escopo travado (Criar, Exportar, Atribuir, Acesso total) explicam por que o escopo é fixo.
- Se o catálogo tiver uma descrição própria da permissão, ela é usada no lugar do texto genérico.

## Detalhes técnicos
- `src/lib/access-control/scope-matrix.ts`: nova função pura `describeFunctionality(action, resourceLabel, catalogLabel?)` e campo `tooltip` na linha.
- `src/components/access-control/permissions-matrix.tsx`: trocar o `title` nativo da célula Funcionalidade por `Tooltip` do shadcn (`@/components/ui/tooltip`), com `tabIndex=0` e `aria-describedby` para teclado e leitores de tela.
- Sem mudança de banco, permissões ou regras.

## Validação
- Teste unitário em `scope-matrix.test.ts` para o texto de cada ação.
- typecheck, lint, build e Playwright: passar o mouse em "Editar" e "Acesso total" e conferir o balão (claro/escuro).
