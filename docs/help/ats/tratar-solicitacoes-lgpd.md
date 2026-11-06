---
module_key: ats
slug: tratar-solicitacoes-lgpd
title: Tratar solicitações LGPD (DSAR)
summary: Registrar pedidos de titulares, exportar, anonimizar e revisar retenção.
article_type: howto
route_pattern: /compliance
min_permission: techhire.compliance.view.own
audience: internal
sort_order: 90
version: 1
is_published: true
---
# Tratar solicitações LGPD (DSAR)
**Para que serve:** Cumprir pedidos de titulares de dados.
**Quem pode fazer:** Ver exige `techhire.compliance.view`. Registrar exige `techhire.compliance.create`. Exportar, anonimizar e rejeitar dependem da permissão sobre a solicitação; o banco confere.
**Onde fica:** Menu > TechHire > Compliance > LGPD & DSAR (`/compliance`).
**Antes de começar:** Tenha o ID do candidato (está na URL /candidates/...).

## Passo a passo
1. Na aba "Solicitações DSAR", clique em "Nova solicitação".
2. Em "Registrar DSAR", preencha "ID do candidato" e "Tipo de solicitação".
3. Se quiser, informe "E-mail do titular" e "Notas". Clique em "Registrar".
4. Para exportar, clique em "Baixar JSON".
5. Para anonimizar, clique em "Anonimizar", digite ANONIMIZAR e clique em "Confirmar".
6. Para recusar, clique em "Rejeitar".
7. Na aba "Retenção", revise os candidatos vencidos.
<!-- screenshot: registrar DSAR -->

## Resultado esperado
"Solicitação registrada", "Exportação concluída" ou "Candidato anonimizado".

## Regras e limites
- Tipos: Exportação de dados, Acesso aos dados, Exclusão / Anonimização, Retificação.
- Status: pendente, em andamento, concluída, rejeitada.
- Anonimizar não pode ser desfeito.
- Notas até 2.000 caracteres. Lista até 200 solicitações e 500 retenções.

## Erros comuns
- Confirmar desabilitado: digite exatamente ANONIMIZAR.
- ID inválido: copie o identificador da URL do candidato.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)
