# Caminho feliz do TechSales — diagnóstico e atividades de implementação

Analisei os 12 macro-passos contra o que existe hoje no sistema. A conclusão curta: **as telas e entidades de cada etapa existem, mas os "elos" entre elas não existem**. Hoje o vendedor precisa recriar manualmente cada objeto (proposta → contrato → projeto → financeiro → vaga → contas a pagar), sem herança de dados e sem rastreabilidade de origem.

## Situação atual por etapa

| # | Etapa | Situação | O que falta |
|---|---|---|---|
| 1 | Cadastrar lead | Pronto | — |
| 2 | Qualificar com questionário | Pronto (questionários + qualificações) | Exigir qualificação mínima antes de criar negócio |
| 3 | Criar negócio | Pronto (criar negócio a partir do lead) | Pipeline/estágios dedicados ao fluxo de serviços |
| 4 | Reunião de apresentação | Pronto (reuniões/agenda) | Etapa do pipeline não exige a reunião registrada |
| 5 | Evoluir para um serviço (Outsourcing, Fábrica de Software, Hunting, Análise/Consultoria) | Parcial | Não existe classificação de "linha de serviço" que direcione proposta, contrato, projeto e vaga |
| 6 | Enviar proposta | Parcial e duplicado | Existem dois conceitos paralelos (Propostas e Cotações). Precisa unificar o caminho oficial |
| 7 | Cliente assinar a proposta | Parcial | Assinatura eletrônica existe, mas o retorno assinado não muda o estado da proposta de forma confiável |
| 8 | Gerar contrato a partir da proposta assinada | **Não existe** | Sem vínculo proposta → contrato e sem ação "gerar contrato" usando o modelo da linha de serviço |
| 9 | Cliente devolver contrato assinado | **Não existe** | Documento de assinatura não se vincula ao contrato nem marca a data de assinatura |
| 10 | Contrato assinado → criar projeto + contas a receber | **Não existe** | Campos de vínculo existem no banco, mas não há ação nem automação que crie projeto e recebíveis |
| 11 | Abrir vaga para o projeto | Parcial | Vaga se liga ao negócio, mas não ao projeto/contrato |
| 12 | Profissional contratado → contas a pagar | **Não existe** | Contratação não gera alocação nem pagáveis automaticamente |

**Estimativa:** o caminho feliz está aproximadamente **55–60% pronto** em telas e dados, e **~20% pronto** em automação de ponta a ponta. O esforço restante concentra-se em 6 elos de integração.

## Atividades propostas (por fase)

### Fase A — Linha de serviço e pipeline do caminho feliz
- A1. Criar o conceito de "linha de serviço" (Outsourcing, Fábrica de Software, Hunting, Análise/Consultoria) no catálogo, com modelo de contrato, tipo de cobrança e tipo de vaga padrão por linha.
- A2. Pipeline de negócio com estágios do caminho feliz: Qualificação → Apresentação → Serviço definido → Proposta enviada → Proposta assinada → Contrato enviado → Contrato assinado → Ganho.
- A3. Barra de progresso do caminho feliz no detalhe do negócio, mostrando o próximo passo e o que está bloqueando.

### Fase B — Proposta oficial e assinatura
- B1. Definir Propostas como caminho oficial e transformar Cotações em origem de itens/valores (sem quebrar registros existentes).
- B2. Gerar proposta a partir do negócio já com empresa, contato, itens de serviço e valores herdados.
- B3. Fechar o ciclo de assinatura da proposta: retorno assinado marca a proposta como aceita, registra data e arquivo, e avança o estágio do negócio.

### Fase C — Contrato a partir da proposta
- C1. Vincular contrato à proposta de origem.
- C2. Ação "Gerar contrato da proposta": escolhe o modelo pela linha de serviço, preenche as variáveis com dados da proposta/empresa e cria o contrato de prestação em rascunho.
- D1 (junto). Enviar contrato para assinatura direto do detalhe do contrato.
- C3. Retorno do contrato assinado: vincula o documento assinado ao contrato, grava a data de assinatura e muda o status para ativo.

### Fase D — Projeto e contas a receber
- D2. Ação "Criar projeto do contrato", herdando empresa, serviços, responsável e datas.
- D3. Geração de contas a receber conforme a cadência do serviço (mensal, marcos ou pagamento único), com prévia e confirmação antes de criar.
- D4. Painel de entrega no contrato mostrando projeto e recebíveis gerados.

### Fase E — Vaga e contas a pagar
- E1. Vincular vaga ao projeto e ao contrato, além do negócio.
- E2. Ação "Abrir vaga para o projeto", pré-preenchendo perfil, senioridade e competências pelo serviço contratado.
- E3. Ao registrar contratação do profissional, criar a alocação vinculada ao projeto/contrato.
- E4. Geração de contas a pagar a partir da alocação (custo do profissional), com prévia e confirmação.

### Fase F — Visibilidade e validação
- F1. Painel do caminho feliz: quantos negócios estão em cada elo e onde travam.
- F2. Teste ponta a ponta do fluxo completo (lead até contas a pagar).

## Detalhes técnicos

- Vínculos ausentes a criar: `contracts.proposal_id`, `esign_documents.contract_id`, `ats_jobs.project_id` e `ats_jobs.contract_id`, além de campo de linha de serviço no catálogo. Já existem e serão reaproveitados: `projects.contract_id`, `financial_entries.contract_id/project_id/origin_type`, `people_allocations.contract_id/project_id`, `contracts.signed_at`, `contracts.deal_id`.
- Toda nova coluna entra como opcional e aditiva; nenhuma policy existente será afastada — apenas estendida para as novas colunas.
- Cada geração (contrato, projeto, recebíveis, pagáveis) será uma ação explícita com prévia e confirmação, e será idempotente (não duplica se executada duas vezes). Automação por workflow fica como opção posterior, não como padrão.
- As telas seguem o design system: cabeçalho padrão, estados de carregamento/vazio/erro, badges semânticas e rótulos em português.
- Não haverá alteração de regra de negócio fora do escopo dos 12 passos.

## Sugestão de ordem

Fases C e D são o maior gargalo hoje (proposta assinada → contrato → projeto → recebíveis). Recomendo começar por A1/A2 (base mínima) e depois C e D, deixando E por último.
