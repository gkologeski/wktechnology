# Contratos: criação completa, padrões configuráveis e fim dos campos em inglês

## 1. Novo contrato passa a ser um formulário completo

Hoje a tela de novo contrato pede apenas tipo, título, empresa, início, fim e valor total.

Passa a funcionar assim:

1. **Primeiro passo — tipo de documento**: Contrato de prestação, Contrato de compra ou Aditivo.
   O tipo escolhido define quais campos aparecem (aditivo pede contrato principal, número e data de vigência do aditivo).
2. **Demais passos — todos os campos do contrato**, agrupados:
   - Identificação: título, número, empresa contraparte, empresa contratante, negócio de origem, responsável, contrato principal.
   - Vigência: início, fim, renovação automática, aviso prévio, período de experiência.
   - Valores: valor total, valor mensal, horas por mês, moeda.
   - Cobrança: dia de pagamento, forma de pagamento, condições, multa por atraso, juros, reembolso de despesas.
   - Reajuste: índice e periodicidade.
   - Serviço: tipo de serviço, escopo, local de execução.
   - Jurídico: lei aplicável, foro, multa rescisória, prazo de cura, aviso de rescisão unilateral, prazo de sigilo.
   - Modelo/corpo do contrato.
3. Campos obrigatórios continuam sendo só título e tipo; o resto é opcional, então nada trava quem quer criar rápido.

## 2. Contrato criado a partir de um negócio carrega os serviços

Quando a criação parte de um negócio (botão no negócio ou ação de workflow):

- Os itens de linha do negócio são lidos e exibidos como lista de serviços já no diálogo, com a cobrança legível ("R$ 250/hora × 160h/mês", "100% do salário alvo por vaga").
- Empresa, moeda, responsável, valor total e valor mensal vêm do negócio.
- Tipo de serviço, local de execução e unidade são deduzidos dos serviços do negócio quando houver um valor dominante.
- O usuário pode desmarcar serviços que não quer levar antes de criar.
- A ação de workflow "Criar contrato a partir do negócio" usa exatamente os mesmos padrões, para o resultado ser igual pelos dois caminhos.

## 3. Tela de padrões de contrato

Nova tela em Configurações de TechContracts: **Padrões de contrato**.

- Define o valor padrão de cada campo: moeda = BRL, forma de pagamento = Pix, local de execução = Remoto, índice de reajuste, periodicidade, dia de pagamento, aviso prévio, multa, juros, lei aplicável, foro, prazo de sigilo, tipo de serviço, provedor de assinatura, etc.
- Um conjunto de padrões por tipo de documento (prestação, compra, aditivo), mais um conjunto geral usado como base.
- Os padrões são aplicados automaticamente em qualquer criação de contrato: diálogo manual, criação a partir do negócio e ação de workflow. O que vem do negócio tem prioridade sobre o padrão; o que o usuário digita tem prioridade sobre tudo.
- Estados de carregando, vazio, erro e salvamento com aviso de sucesso.

## 4. Nenhum campo em inglês

- Os campos de contrato sem tradução hoje passam a ter rótulo em português: Tipo de documento, Número do aditivo, Aditivo de, Vigência do aditivo.
- Os valores desses campos também ganham lista em português (Contrato principal / Aditivo), em vez de aparecerem como `main` / `amendment`.
- Para valer no sistema todo, entra um teste automático que percorre as entidades principais e falha quando alguma coluna visível cai no nome cru em inglês, sem rótulo em português. Assim uma coluna nova não volta a aparecer em inglês.

## Detalhes técnicos

- Nova tabela `public.contract_defaults` (workspace-scoped): `workspace_id`, `document_kind` nulo = geral, `defaults jsonb`, timestamps, índice único por (`workspace_id`, `document_kind`). Migration com `CREATE TABLE` → `GRANT` → `ENABLE RLS` → policies por `workspace_id`, seguindo o padrão do projeto.
- Server functions novas em `src/lib/contracts/contract-defaults.functions.ts`: `getContractDefaults`, `saveContractDefaults` (com `assertAnyPermission` de configuração de contratos).
- `src/lib/contracts/workflow-field-meta.ts`: adicionar rótulos e opções faltantes (`document_kind`, `amendment_number`, `amendment_of_id`, `amendment_effective_at`) e marcar campos de aditivo como dependentes do tipo.
- `createContract` em `src/lib/contracts.functions.ts` passa a aceitar o conjunto completo de campos e a mesclar padrões no servidor (padrão < negócio < entrada do usuário), mantendo geração de número e token.
- `createContractFromDeal` e `src/lib/workflows/engine/actions-contracts.server.ts` passam a usar o mesmo módulo de merge de padrões e a mesma leitura de itens de linha — sem duplicar regra.
- `quick-create-contract-dialog.tsx` é dividido em etapas e seções (`FormSection`), respeitando o limite de 350 linhas por arquivo: seleção de tipo, seções de campos e prévia de serviços em módulos próprios.
- Nova rota `src/routes/_authenticated/settings.contract-defaults.tsx` + item no menu de contratos.
- Teste de cobertura de rótulos em `src/lib/__tests__` comparando colunas conhecidas com o dicionário PT-BR.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test`.
