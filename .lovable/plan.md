# TEMPO-ITENS + CONDICOES-PAGAMENTO

Duas entregas separadas, nesta ordem.

## Parte 1 — TEMPO-ITENS (erro "statement timeout" nos itens de linha)
Porte P/M, 2–4 h.

O que já vi: cada alteração de valor grava o item na hora; o item tem 9 gatilhos no banco, e dois deles recalculam o valor do Negócio, que por sua vez tem 19 gatilhos. A causa exata ainda não está confirmada.

1. Reproduzir com sua conta: medir a gravação de um item e ler os registros de consultas lentas e de tempo esgotado do banco para achar o gatilho/política culpado (inclui os erros "a cada alguns minutos", que podem vir de outra tela ou de tarefa automática).
2. Corrigir a causa confirmada, por exemplo: juntar os dois recálculos do Negócio num só, evitar regravar o Negócio quando o valor não mudou, otimizar a regra de permissão lenta (padrão já usado nas tabelas grandes de vendas), sem mudar quem pode ver ou editar.
3. Na tela: agrupar digitação (gravar após uma pausa curta, não a cada tecla), repetir automaticamente em erro passageiro e mostrar mensagem em português ("Não foi possível salvar, tentando de novo") no lugar do texto técnico.
4. Teste de regressão do tempo e da regra de permissão.

## Parte 2 — CONDICOES-PAGAMENTO (forma de pagamento na cotação → proposta → contrato → TechFinance)
Porte G, 2–3 dias, em fases com entrega e teste por fase.

### Como funciona para o usuário
Na cotação, nova seção "Condições de pagamento", sugerida a partir dos itens:
- Item recorrente (ex.: outsourcing): plano **mensal** — valor por mês, dia de vencimento, duração em meses (ou indeterminada).
- Item de projeto (consultoria, fábrica de software): plano **de projeto** com:
  - **Entrada** opcional em R$ ou % do total, com data ou "na assinatura".
  - **Saldo** dividido de forma escolhida pelo usuário:
    - Periódico: N parcelas iguais (mensal, quinzenal, bimestral, trimestral...), primeiro vencimento e dia.
    - Por entregas/marcos: lista livre de marcos (nome, % ou R$, data prevista ou "ao aceite da entrega").
    - Personalizado: linhas livres de valor e data.
- Cotação mista: um plano por grupo (recorrente e projeto) ao mesmo tempo.
- Forma de pagamento (boleto, Pix, transferência, cartão) e observações por plano.
- Validação: a soma das parcelas fecha com o total; aviso claro se não fechar.
- Prévia do cronograma (data, descrição, valor).

### Propagação
- **Proposta**: ao converter a cotação, copia as condições; a proposta passa a editar a mesma seção (substitui "parcelas + dia de vencimento", mantendo os campos atuais preenchidos para propostas antigas). Novas variáveis no texto/PDF: cronograma de pagamento, entrada, marcos.
- **Contrato**: copia as condições da proposta; aparece na aba de dados; variáveis no modelo de contrato; checklist de "Próximo passo" exige condições definidas.
- **TechFinance**: ao ativar o contrato (via workflow, conforme a regra do projeto), gera contas a receber:
  - mensal → recorrência mensal;
  - entrada e parcelas periódicas → lançamentos com data;
  - marcos sem data → lançamentos "aguardando entrega", com data definida quando o marco for aceito.
  - Sem duplicar se já existir lançamento para o contrato; tudo ligado à origem para rastreio.

### Fases
1. Banco + regra pura do cronograma (cálculo, validação, testes).
2. Seção na cotação (com mockup para aprovação antes, por ser tela nova).
3. Proposta e documento/PDF.
4. Contrato e modelos.
5. Geração do contas a receber + workflow.
6. Ajuda (artigos de cotação, proposta, contrato e contas a receber) e permissões.

## Detalhes técnicos
- Nova tabela `payment_plans` + `payment_plan_installments` (workspace_id, origem: quote/proposal/contract, tipo recurring/project, entrada valor/percentual, modo do saldo periodic/milestone/custom, frequência, parcelas), com GRANT → RLS → policies seguindo as permissões existentes de cotação/proposta/contrato (sem conceder nada novo a cargos automaticamente). Cópia (snapshot) a cada conversão em `sales-flow.server.ts`, sem vínculo vivo.
- Campos antigos `installments_count/installments_due_day/payment_method` continuam preenchidos (compatibilidade); migração aditiva.
- Regra pura `src/lib/payments/payment-plan.ts` gera o cronograma; mesma função usada na tela, nos documentos e no financeiro.
- Contas a receber via ação de workflow "Gerar recebíveis do contrato" sobre `financial_entries` / `financial_recurrences` com `origin_type='contract'`, idempotente.
- Marcos sem data: lançamento em aberto sem vencimento até o aceite (confirmar no banco se `financial_entries` aceita isso; senão, criar só no aceite).
- Contratos de permissão e testes de 5 cenários para cada nova ação.

## Perguntas em aberto (respondo com padrão se não houver resposta)
- Contas a receber nascem na ativação do contrato (padrão) ou na assinatura?
- Cotações/propostas antigas: recebem plano automático a partir das parcelas atuais (padrão) ou ficam como estão?
