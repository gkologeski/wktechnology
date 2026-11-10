# PROPOSTA-COMPLETA — proposta aceita gera contrato sem pedir dados de novo

Porte: P/M — estimativa 1h–1h30.

## Por que deu erro
A proposta da ÓGEA (aceita) tem no **texto** "1x de R$ 45.000,00, vencimento 15/11/2026", mas os **campos** Parcelas, Dia de vencimento e Forma de pagamento estão vazios no cadastro (conferido no banco). O contrato lê só os campos, não o texto. A proposta foi criada antes de esses campos existirem/serem obrigatórios, e o assistente deixou aceitar sem preenchê-los.

## O que fazer
1. **Exigir os dados antes de enviar/aceitar a proposta**: no assistente da proposta, Parcelas e Dia de vencimento passam a ser obrigatórios (padrão 1 parcela) para enviar ou marcar como aceita. Aviso claro do que falta.
2. **Pré-preencher no Novo contrato**: no passo Dados, mostrar Parcelas e Dia de vencimento já com os valores da proposta; se a proposta não tiver, o campo fica destacado como obrigatório já no passo Dados (não só no fim, em Revisão).
3. **Corrigir a proposta da ÓGEA**: preencher 1 parcela, dia 15 e forma de pagamento conforme o texto (com sua confirmação da forma de pagamento).
4. Atualizar Ajuda (editar-enviar-proposta e gerar-de-modelo) e testes da regra.

## Fora do escopo
Não ler o texto livre para adivinhar valores (risco de dado errado). Permissões não mudam.

## Detalhes técnicos
- `ProposalWizard`: validação zod condicional para status sent/accepted.
- `contract-wizard.tsx`: inicializar estados com termos da proposta de origem e bloquear Avançar no passo Dados quando faltarem.
- Atualizar contratos em `permission-contracts.json` (sem regenerar baseline).
