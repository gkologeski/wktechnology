# Escopos próprio e de equipe para Atividades

## Situação atual (verificada no catálogo)

Chaves existentes hoje para Atividades (`techsales.activities`):

```text
techsales.activities.view.workspace
techsales.activities.create.own
techsales.activities.update.own
techsales.activities.update.workspace
techsales.activities.delete.workspace
```

O combo de cada célula em `/settings/permissions` só oferece escopos que existem como chave real no catálogo. Por isso "Da minha equipe" não aparece em nenhuma ação de Atividades, e "Meu(s)/Minha(s)" não aparece em Exibir nem Excluir.

## O que será feito

Migration aditiva inserindo as 5 chaves que faltam para Atividades:

- `techsales.activities.view.own` — "Ver próprias atividades"
- `techsales.activities.view.team` — "Ver atividades da equipe"
- `techsales.activities.update.team` — "Editar atividades da equipe"
- `techsales.activities.delete.own` — "Excluir próprias atividades"
- `techsales.activities.delete.team` — "Excluir atividades da equipe"

Resultado em `/settings/permissions`: Exibir, Editar e Excluir de Atividades passam a oferecer Nenhuma / Meu(s)/Minha(s) / Da minha equipe / Todos — inclusive para o cargo "Vendedor Interno".

Nenhuma concessão é criada ou removida: os cargos continuam exatamente com o que têm hoje; apenas as opções passam a existir. Criar continua travado em "Meu(s)/Minha(s)" (regra intencional).

## Detalhes técnicos

- Migration com `INSERT ... ON CONFLICT (key) DO NOTHING` em `public.permissions`, reaproveitando `module`, `resource`, `action` e demais colunas das chaves irmãs já existentes.
- Sem alteração de RLS, grants, server functions ou schema.
- `src/lib/access-control/scope-matrix.ts` e `permissions-matrix.tsx` não mudam: as opções já são derivadas do catálogo.

## Observação importante sobre efeito prático

A chave habilita a configuração no RBAC. Onde a consulta de Atividades ainda não filtra por equipe/próprio, o escopo escolhido é reconhecido mas o filtro efetivo pode se comportar como o escopo mais amplo suportado pela query. Se quiser, faço em seguida um levantamento de quais consultas de Atividades já respeitam `own`/`team` e ajusto os filtros.

## Como validar

1. Reconsultar o catálogo de `techsales.activities` (deve listar 10 chaves).
2. Em `/settings/permissions`, módulo TechSales → recurso Atividades: conferir as opções em Exibir, Editar e Excluir para "Vendedor Interno".
3. Conferir que nenhum escopo já concedido mudou.
