# Como organizar os serviços (sugestão)

## Diagnóstico do estado atual

O catálogo hoje tem 4 itens (`Outsourcing de TI`, `Fábrica de Software`, `Hunting de TI`, `Consultoria Técnica`), com categoria, tipo, unidade, preço/custo, imposto, SLA, competências e tags. Existem 4 contratos e apenas 2 serviços vinculados a contratos. Em `people`, `role_title` está praticamente vazio (184 pessoas sem cargo, 1 com "ceo").

Ou seja: o catálogo está bom como **oferta comercial**, mas não tem onde registrar **o que a pessoa faz** (cargo/perfil) — e é isso que está faltando para o seu caso.

## Recomendação: não explodir o catálogo por tecnologia

Criar um item de catálogo por tecnologia/cargo ("Dev React Sênior", "Dev Java Pleno", "Coordenador de RH"...) gera dezenas de itens duplicados, com preço e imposto repetidos, e quebra relatórios de receita por linha de negócio.

O melhor modelo é separar em **três dimensões**:

| Dimensão                  | Onde vive                                  | Exemplos                                                                         |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Linha de serviço (oferta) | `service_catalog` — poucos itens, estáveis | Outsourcing de TI, Fábrica de Software, Consultoria, Hunting, BPO Administrativo |
| Cargo / perfil contratado | no serviço do contrato                     | Desenvolvedor, Assistente Financeiro, Coordenador de RH, Analista de Dados, QA   |
| Senioridade + stack       | no serviço do contrato (tags)              | Júnior/Pleno/Sênior; React, Java, .NET, Salesforce                               |

Assim "Outsourcing de TI" continua sendo o serviço de todos os alocados, e cada contrato diz **qual cargo, qual senioridade e qual stack** foi contratado. Preço e imposto ficam por contrato (como já ficam), não por variação de catálogo.

Sugestão prática de catálogo enxuto: adicionar **BPO Administrativo/Financeiro** e **Recursos Humanos (BPO)** para os cargos internos que não são de TI, e manter os 4 atuais. Total ~6 linhas de serviço.

## O que construir

1. **Cadastro de cargos (perfis)** — uma lista gerenciável de cargos ("Assistente Financeiro", "Coordenador de RH", "Desenvolvedor Full Stack"...), cada um ligado a uma linha de serviço do catálogo e com senioridade opcional. Tela em Configurações, no padrão das telas de lista existentes.
2. **No serviço do contrato**: campos "Cargo/Perfil", "Senioridade" e "Stack/Competências" (tags). Ao escolher o cargo, a linha de serviço e o preço-base sugerido são preenchidos automaticamente — sem impedir ajuste manual.
3. **Agrupamentos e relatórios**: aproveitar o agrupamento já existente em `/contracts` para também agrupar por **Cargo** e por **Senioridade**, além de Empresa e Serviço.
4. **Ligação com pessoas**: preencher `people.role_title`/`seniority` a partir do cargo do contrato quando a pessoa estiver alocada, para o RH ver headcount por cargo.

## Detalhes técnicos

- Nova tabela `job_profiles` (workspace-scoped, RLS + GRANTs no padrão do projeto): `name`, `service_catalog_id`, `seniority`, `default_unit_price`, `tags[]`, `active`.
- Novas colunas em `services`: `job_profile_id` (FK), `seniority`, `competencies text[]` — aditivas, nada existente muda.
- `listContractGroupings` em `src/lib/contracts.functions.ts` ganha os modos `job_profile` e `seniority`; `contracts-grouped-list.tsx` só recebe os novos rótulos.
- Seletor de cargo reaproveita o padrão Popover + Command já usado em `link-catalog-service-dialog.tsx`.
- Fases: (1) tabela + tela de cargos, (2) campos no serviço do contrato + autopreenchimento, (3) agrupamentos, (4) sincronização com `people`.

Se preferir começar menor, a Fase 1 + Fase 2 já resolvem o seu caso imediato (contrato por cargo) sem tocar em relatórios.
