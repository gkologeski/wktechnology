---
module_key: people
slug: acompanhar-offboarding
title: Acompanhar offboarding
summary: Ver desligamentos e o checklist de compliance.
article_type: howto
route_pattern: /people/offboarding
min_permission: techpeople.offboarding.view.own
audience: internal
sort_order: 41
version: 3
is_published: true
---
# Acompanhar offboarding
**Para que serve:** Acompanhar desligamentos e o checklist de saída.
**Quem pode fazer:** Quem tem `techpeople.offboarding.view` (own, team ou workspace).
**Onde fica:** Menu > TechPeople > Pessoas > Offboarding (`/people/offboarding`).
**Antes de começar:** O plano é iniciado na ficha da pessoa, aba "Onboarding · Desligamento".

## Passo a passo
1. Abra a tela.
2. Confira "Status", "Progresso", "Início" e "Alvo".
3. Clique em "Abrir" para ir à ficha.
![Tela: offboarding](/help-media/people/acompanhar-offboarding.webp)

## Resultado esperado
Você vê o andamento de cada desligamento.

## Regras e limites
- Mesmos status do onboarding. Concluídos e cancelados também aparecem.
- Tela só de consulta; as tarefas são marcadas na ficha.

## Erros comuns
- "Você não tem permissão para consultar esta tela.": falta `techpeople.offboarding.view`.

## Relacionados
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)

## Automação de desligamento (Workflows)
Em Workflows, o modelo **Desligamento** dispara quando a pessoa passa para "Desligado" e pode:
- revogar o acesso do usuário (ele fica inativo, o nome continua no histórico);
- **desligar agendas e e-mails** conectados dele;
- **transferir a carteira** (leads, negócios, contatos, empresas e atividades) para o gestor da pessoa ou para quem você escolher. Sem gestor, cria uma tarefa para o administrador escolher.
O fluxo vem desligado; ative e revise os passos. Só funciona com dono do workflow administrador e quando a ficha da pessoa está ligada a um usuário (pelo vínculo ou e-mail corporativo); sem vínculo, nada é feito e fica para revisão manual.
