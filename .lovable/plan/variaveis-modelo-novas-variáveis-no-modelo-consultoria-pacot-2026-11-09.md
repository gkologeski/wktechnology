# VARIAVEIS-MODELO — novas variáveis no modelo "Consultoria - Pacote de Horas"

Porte: P — estimativa 20–30 min.

## Situação conferida
O modelo (publicado) usa hoje apenas: número, tipo de serviço, multa, lei aplicável, foro, dados de contratante/contratada e dados da proposta. Não usa vigência, parcelas, vencimento nem signatário.

## O que será feito
1. Ajustar só o texto do modelo (sem mexer em telas, permissões ou regras):
   - Cláusula de vigência: "vigência de {{contract.validity_days}} dias".
   - Cláusula de pagamento: "em {{contract.installments_count}} parcela(s), com vencimento todo dia {{contract.installments_due_day}}".
   - Qualificação da contratante e bloco de assinatura: "representada por {{signer.full_name}}, CPF {{signer.cpf}}".
   - Onde já houver texto fixo equivalente, substituir pelo token; se não houver cláusula, inserir no ponto mais próximo (pagamento/prazo/assinaturas), preservando a formatação original.
2. Antes de gravar, guardar cópia do conteúdo atual (duplicar como rascunho "backup") para poder voltar.
3. Conferir gerando a pré-visualização com a proposta 805c9cbb: vigência 90 dias e signatário Marcos Gulfier / CPF 168.773.388-04 devem aparecer; parcelas ficarão vazias até serem informadas na proposta.

## Fora do escopo
Outros modelos; geração definitiva do contrato; publicação do app.

## Detalhes técnicos
Atualização de `contract_templates.body_html` (id c789ce83…) pela própria tela de edição do modelo ou update pontual de dados; sem migração, sem RLS. Ajuda não muda (variáveis já documentadas em gerar-de-modelo v4).
