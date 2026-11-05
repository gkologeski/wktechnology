---
module_key: contracts
slug: revisar-medicao
title: Revisar, ajustar e enviar uma medição para revisão
summary: Revisar, ajustar e enviar uma medição para revisão no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 72
version: 1
is_published: true
---
# Revisar, ajustar e enviar uma medição para revisão
**Para que serve:** Revisar, ajustar e enviar uma medição para revisão.
**Quem pode fazer:** techprojects.measurements.view.workspace para consultar e manage.workspace para atualizar, ajustar e enviar.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em rascunho e fontes disponíveis.

## Passo a passo
1. Abra o detalhe da medição.
2. Clique em "Atualizar prévia" e confira linhas, itens excluídos e pendências.
3. Quando necessário, use "Adicionar ajuste", informando descrição, valor e motivo. Valor negativo representa desconto.
4. Para sucesso/Hunting, use "Adicionar evento" e escolha proposta ou candidatura do TechHire com identificador/base exigidos.
5. Resolva "Pendências (impedem envio e aprovação)".
6. Clique em "Enviar para revisão".
<!-- screenshot: Revisar, ajustar e enviar uma medição para revisão, sem dados pessoais reais -->

## Resultado esperado
Medição em revisão; nenhum documento ou cobrança enviado ao cliente.

## Regras e limites
- Ajuste: descrição de 3–200 caracteres, valor finito diferente de zero e motivo de 10–2.000 caracteres.
- Evento exige UUID válido; o sistema não presume um evento de sucesso automaticamente.
- Fontes alteradas exigem atualizar a prévia. Envio valida o hash.
- Ajuste não é alteração silenciosa da tarifa.

## Erros comuns
SUBMIT_BLOCKED: resolva as pendências impeditivas. Prévia desatualizada: atualize antes de enviar.

## Relacionados
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)
