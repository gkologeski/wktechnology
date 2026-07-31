# Corrigir /settings/permissions (matriz vazia — "Nenhuma permissão encontrada")

## Diagnóstico confirmado

A rota carrega e renderiza, mas a matriz vem incompleta/vazia. A causa é o limite de 1.000 linhas do Data API nas consultas de catálogo, exatamente o mesmo padrão já corrigido antes em permissões efetivas.

Verificado no banco:

- `public.permissions` tem **1.625** linhas: system 448, techcontracts 21, techfinance 173, techhire 326, techpeople 191, techprojects 77, techsales 347, techservice 42.
- `getAccessBundle` faz `from("permissions").select("*").order("module").order("key")` **sem paginação**. Com corte em 1.000 linhas na ordem alfabética de módulo, entram: system, techcontracts, techfinance, techhire e apenas parte de techpeople — e **techprojects, techsales e techservice não chegam ao cliente**.
- Isso casa exatamente com o print: as abas exibidas são TechHire, TechPeople, TechContracts, TechFinance e Sistema; TechSales, TechService e TechProjects desaparecem.
- Como `activeModule` inicia fixo em `"techsales"` e esse módulo não está na lista carregada, nenhuma linha é filtrada e a tabela mostra "Nenhuma permissão encontrada".
- `public.permission_set_items` tem **8.821** linhas e também é lido sem paginação (`select("set_id, permission_key")`), então as composições de cargos/conjuntos ficam truncadas e os toggles aparecem desmarcados mesmo quando concedidos.

## O que será feito

1. **Paginar as leituras de catálogo em `getAccessBundle`** (`src/lib/access-control/access.functions.ts`): buscar `permissions` e `permission_set_items` em lotes de 1.000 via `.range(offset, offset + 999)` até esgotar, seguindo o mesmo padrão de lote já usado em `permissions.functions.ts`. Aplicar o mesmo cuidado nas demais tabelas do bundle que possam crescer (`permission_sets`, `job_role_sets`, `field_permission_rules`, `workspace_members`, `user_job_roles`, `user_permission_sets`, `profiles`).
2. **Tornar a aba inicial resiliente** em `src/components/access-control/permissions-matrix.tsx`: em vez de fixar `"techsales"`, selecionar o primeiro módulo presente em `modulesWithData` quando o módulo atual não existir no catálogo carregado — evitando tela vazia em qualquer cenário futuro.
3. **Diferenciar estados** na matriz: manter loading skeleton enquanto `bundleQ`/`matrixQ` carregam, exibir `ErrorState` quando a consulta falhar e reservar "Nenhuma permissão encontrada" apenas para busca sem resultado.
4. **Revisar `getMatrixState`** (`src/lib/access-control/role-bundle.functions.ts`) e paginar a leitura de `job_role_sets` + overrides pelo mesmo critério, para não repetir o truncamento quando o número de vínculos crescer.

## Detalhes técnicos

- Arquivos previstos: `src/lib/access-control/access.functions.ts`, `src/lib/access-control/role-bundle.functions.ts`, `src/components/access-control/permissions-matrix.tsx`.
- Nenhuma migration, mudança de RLS, de schema ou de regra de negócio: o problema é somente de paginação de leitura e de estado inicial de UI.
- Helper de paginação local (loop com `.range`) reutilizável dentro dos arquivos de server functions; sem novas dependências.

## Validação

- `tsgo --noEmit` e testes existentes.
- Verificação em execução: abrir `/settings/permissions` e confirmar as 8 abas (TechSales, TechHire, TechPeople, TechContracts, TechService, TechFinance, TechProjects, Sistema), com linhas de recurso/ação listadas e toggles refletindo os vínculos reais dos cargos.
