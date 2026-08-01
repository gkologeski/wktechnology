# Por que falta "Da minha equipe" em Atividades → Editar

## Racional atual

O combo de cada célula **não tem lista fixa de escopos**. Ele mostra apenas os escopos que existem como chave real no catálogo de permissões (`permissions`), no formato `modulo.recurso.acao.escopo`. Se a chave não existe, a opção não aparece — porque conceder um escopo inexistente não teria efeito nenhum no backend.

Consulta ao catálogo para Atividades (TechSales):

```text
techsales.activities.view.workspace
techsales.activities.create.own
techsales.activities.update.own
techsales.activities.update.workspace
techsales.activities.delete.workspace
```

Ou seja: não existe `techsales.activities.update.team`. Por isso "Vendedor Interno" só vê "Nenhuma", "Meu(s)/Minha(s)" e "Todos" em Editar.

Isso **não foi uma decisão de produto** sobre Atividades — é uma lacuna de cadastro do catálogo. A maioria dos recursos já tem o escopo de equipe (130 de 153 recursos em Editar; 131 de 160 em Exibir), e Atividades ficou entre os que faltaram.

Regras que continuam sendo decisão intencional (não mudam): Criar travado em "Meu(s)/Minha(s)", Exportar/Atribuir/Acesso total travados em "Todos".

## Lacunas encontradas

- Exibir sem escopo de equipe: 29 recursos (ex.: `techsales.activities`, `techsales.emails`, `techservice.tickets`, `techprojects.time_entries`, `techhire.interviews`).
- Editar sem escopo de equipe: 23 recursos (mesma família).
- Excluir sem escopo de equipe: praticamente todos (151) — hoje Excluir é own/workspace por padrão.

## Proposta

Fase 1 — Completar equipe em Exibir e Editar para os recursos de dados que hoje não têm (29 + 23), incluindo Atividades. Migration aditiva que insere as chaves `...view.team` / `...update.team` no catálogo, com rótulo PT-BR no mesmo padrão das chaves irmãs. Nenhuma concessão é criada: os cargos continuam exatamente com o que têm hoje; apenas a opção passa a existir no combo.

Fase 2 (opcional, só se você quiser) — Adicionar `...delete.team` para recursos de dados. Deixo fora por padrão, pois exclusão em escopo de equipe é uma decisão mais sensível.

Recursos de configuração/administração (módulo `system`, dashboards, integrações) ficam de fora: não são registros com responsável, então escopo de equipe não faz sentido neles.

## Detalhes técnicos

- Migration `INSERT ... ON CONFLICT (key) DO NOTHING` em `public.permissions`, derivando as linhas faltantes a partir das chaves `own`/`workspace` já existentes do mesmo `(module, resource, action)`, filtrando a lista de recursos de dados.
- Sem alteração de RLS, de grants ou de server functions.
- `src/lib/access-control/scope-matrix.ts` e `permissions-matrix.tsx` não precisam mudar: as opções já são derivadas do catálogo.
- Verificação: reconsultar o catálogo de `techsales.activities` e conferir em `/settings/permissions` que "Da minha equipe" aparece em Exibir/Editar de Atividades, sem alterar nenhum escopo já concedido.

## Importante sobre a aplicação do escopo

Adicionar a chave habilita a configuração. Onde a consulta do recurso ainda não filtra por equipe, a chave `team` fica reconhecida pelo RBAC mas o filtro efetivo pode se comportar como o escopo mais amplo disponível na query. Se quiser, faço um levantamento separado de quais consultas de Atividades/E-mails/Tickets já respeitam `team` antes de expandir o catálogo.
