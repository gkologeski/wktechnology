# TIPO-SERVICO — Tipos de serviço do contrato iguais ao catálogo

Porte: P — estimativa 40–60 min.

## Problema
O campo "Tipo de serviço" do contrato usa uma lista fixa (Outsourcing, Desenvolvimento, Manutenção, Consultoria, Licenciamento, Outros), diferente das categorias do Catálogo de Serviços do workspace WK: Outsourcing, Alocação de Squad, Fábrica de Software, Desenvolvimento, Consultoria, Engenharia de IA, BPO e Hunting.

## O que muda
- A lista de "Tipo de serviço" (contrato, modelo de contrato, importação de contrato e campos de workflow) passa a vir das categorias ativas do Catálogo de Serviços do workspace, mais "Não definido" e "Outros".
- Hunting, Alocação de Squad, Fábrica de Software, Engenharia de IA e BPO passam a aparecer.
- Contratos antigos com valores que não estão mais no catálogo (ex.: Manutenção, Licenciamento) continuam exibindo o valor salvo, marcado como "(legado)", sem perder dados.
- Normalizar os 2 contratos gravados como "Outsourcing" (maiúsculo) para o mesmo valor dos demais.
- Ao vincular um serviço do catálogo ao contrato, o tipo é sugerido automaticamente pela categoria do serviço.

## Detalhes técnicos
- Coluna `contracts.service_type` é texto livre: sem migration.
- Novo hook `useServiceTypeOptions()` (lê categorias distintas de `service_catalog` via RLS do workspace) com slug estável (ex.: `hunting`, `alocacao_squad`) e rótulo.
- `SERVICE_TYPES` em `import-schemas.ts` deixa de ser enum fixo no zod (vira string opcional); a extração por IA recebe as opções dinâmicas.
- Atualizar `contracts.$id.tsx`, `contracts.templates.$id.tsx`, `import-contract-file-dialog.tsx`, `link-catalog-service-dialog.tsx`, `workflow-field-meta.ts`.
- Sem nova permissão: leitura do catálogo já segue a permissão atual de contratos/catálogo.
- Atualizar artigo de Ajuda do contrato (bump de versão) e testes do mapeamento de opções (incluindo valor legado).
