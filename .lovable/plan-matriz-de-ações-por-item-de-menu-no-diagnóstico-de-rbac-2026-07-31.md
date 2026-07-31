# Matriz de ações por item de menu no diagnóstico de RBAC

Hoje a coluna "Motivo" de `/settings/rbac-diagnostics` imprime as chaves técnicas (`modulo.recurso.acao.escopo`), o que é ilegível. A tela passa a mostrar, para cada item de menu, uma matriz de ações em PT-BR com o escopo efetivo de cada uma. Tudo somente leitura — conceder/alterar permissão continua em `/settings/permissions`.

## O que muda na tela

A tabela de auditoria do menu ganha linha expansível. Ao expandir um item (ex.: "Campanhas Email"), aparece uma mini-tabela:

```text
Ação        | Acesso
------------|--------------------------------
Exibir      | [ Todos os registros        v ]
Criar       | [ Sem acesso                v ]
Editar      | [ Apenas os meus registros  v ]
Excluir     | [ Sem acesso                v ]
Aprovar     | [ Registros da minha equipe v ]
```

- Linhas fixas quando a funcionalidade tem a chave correspondente no catálogo: Exibir, Criar, Editar, Excluir.
- Linhas condicionais, exibidas só quando existem no catálogo daquele recurso: Aprovar, Mesclar, Exportar, Atribuir, Gerenciar (acesso total).
- A combo é somente leitura (desabilitada, com aparência de select) e mostra o escopo efetivo:
  - Todos os registros (escopo `workspace`)
  - Registros da minha equipe (escopo `team`)
  - Apenas os meus registros (escopo `own`)
  - Sem acesso (nenhuma chave concedida)
- Quando o usuário tem mais de um escopo para a mesma ação, prevalece o mais amplo (workspace > team > own).
- Quando o item é visível apenas por papel (gestor/admin) e não por permissão granular, um aviso indica "acesso herdado do papel de gestor/administrador" e as combos refletem apenas o que existe de granular.
- A coluna "Motivo" passa a usar linguagem natural (ex.: "Oculto: você não tem permissão de visualizar Campanhas") e as chaves técnicas ficam num popover "Ver chaves técnicas", preservando o botão de copiar chave.

## Como cada item de menu é ligado às ações

O item de menu já declara `permissionAny` com chaves como `techsales.marketing.campaigns.view.workspace`. Delas extraímos `module` + `resource` (`techsales` + `marketing.campaigns`) e buscamos no catálogo `public.permissions` todas as chaves daquele recurso, agrupadas por ação e escopo. Itens sem `permissionAny` (sem restrição, ou apenas por papel) mostram a matriz vazia com a explicação correspondente.

## Detalhes técnicos

- `src/lib/access-control/rbac-diagnostics.functions.ts`: nova server function autenticada `listPermissionCatalog` retornando `key, module, resource, action, scope, label_pt` de `public.permissions` (catálogo global, sem dados sensíveis). Nenhuma alteração de RLS, schema ou permissões.
- Novo helper puro `src/lib/access-control/action-matrix.ts`:
  - `ACTION_LABELS_PT` (view→Exibir, create→Criar, update→Editar, delete→Excluir, approve→Aprovar, merge→Mesclar, export→Exportar, assign→Atribuir, manage→Acesso total);
  - `SCOPE_LABELS_PT` (workspace→Todos os registros, team→Registros da minha equipe, own→Apenas os meus registros);
  - `buildActionMatrix(permissionAny, catalog, grantedKeys)` → `{ action, label, scopesAvailable, effectiveScope | null }[]`, com ordem fixa das ações e ocultando ações inexistentes no catálogo.
- `src/lib/menu-audit.ts`: expõe também os recursos derivados (`module.resource`) de cada item, para a matriz não precisar reparsear chaves na UI.
- `src/routes/_authenticated/settings.rbac-diagnostics.tsx`: linha expansível (Collapsible), mini-tabela de ações com `Select` desabilitado, popover de chaves técnicas, motivo reescrito em PT-BR. Mantém filtros, busca, seletor de usuário, loading/empty/error e tokens semânticos do design system.
- Testes: novos casos unitários para `buildActionMatrix` (precedência de escopo, ação ausente no catálogo, sem permissão) em `src/lib/access-control/action-matrix.test.ts`.
- Validações: typecheck, lint, build e testes unitários.

## Fora de escopo

- Nenhuma gravação de permissão nesta tela.
- Nenhuma mudança em RLS, cargos, conjuntos de permissões ou visibilidade real do menu.
