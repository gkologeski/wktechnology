# TEXTO-PROPOSTA — Proposta com as condições que o contrato usa

Porte: M — estimativa 2h30–3h30 (preparado + testado no preview; publicação à parte).

## Problema confirmado
- Os 3 modelos de proposta (Hunting, Consultoria, Outsourcing) só usam: empresa, contato, negócio, tabela de itens, total e "válida até".
- O texto é montado uma única vez ao escolher o modelo; parcelas, vencimento e vigência preenchidos depois no assistente não entram no texto.
- Não existe campo "Forma de pagamento" na proposta.
- O modelo Outsourcing tem vigência "12 meses" escrita à mão, divergindo do campo Vigência (padrão 90 dias).
- Os modelos ainda têm trechos "[Escreva aqui sobre ...]".

## O que será feito
1. **Novo campo "Forma de pagamento"** na proposta (Boleto, PIX, Transferência, Cartão, Outro + observação), ao lado de Parcelas/Vencimento/Vigência; mesma permissão de edição já existente (techsales.proposals.update). O contrato gerado passa a receber essa informação.
2. **Novas variáveis no texto da proposta:** razão social e CNPJ da contratante, forma de pagamento, parcelas, dia de vencimento, valor por parcela, vigência (dias) e entidade contratada (WK/GM).
3. **Bloco "Condições comerciais" automático:** seção marcada no texto que é atualizada sempre que parcelas, vencimento, forma de pagamento ou vigência mudam no assistente — sem apagar o que o vendedor escreveu no restante.
4. **Modelos de proposta atualizados** (com cópia de segurança de cada um): incluir a seção de Condições comerciais nos 3; trocar "12 meses" do Outsourcing pela variável de vigência; manter o restante do texto.
5. **Aviso antes de enviar:** se ainda houver "[Escreva aqui ...]" ou condição comercial vazia, o assistente avisa (não bloqueia).
6. **Ajuda:** atualizar "editar-enviar-proposta" e o artigo de modelos de proposta (bump de versão).

## Fora do escopo
- Reescrever o conteúdo comercial dos modelos (diagnóstico, metodologia etc.).
- Mudar o modelo de contrato (já usa as variáveis).
- Propostas antigas não são reescritas; basta reaplicar o modelo.

## Detalhes técnicos
- Migração aditiva: `proposals.payment_method text null` (CHECK nos valores) + `payment_notes text null`; sem alteração de RLS/GRANT.
- `renderTemplate` em `proposal-wizard.tsx` recebe o contexto ampliado (dados de `proposal-draft.server.ts` estendidos com cnpj/razão social/entidade).
- Bloco delimitado por `<section data-proposal-terms>` regenerado por função pura `renderTermsBlock` (teste unitário: 3x dia 10, PIX, 90 dias, R$45.000 → R$15.000/parcela).
- `sales-flow.server.ts` copia forma de pagamento ao contrato; token `{{contract.payment_method}}`.
- Validações: permissions:check, help:coverage, testes de propostas/contratos, build, Playwright no assistente.
