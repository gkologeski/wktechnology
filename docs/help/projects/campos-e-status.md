---
module_key: projects
slug: campos-e-status
title: Campos e status do TechProjects
summary: Campos e status do TechProjects no TechProjects: operação, acesso e limites comprovados no código.
article_type: reference
route_pattern: 
min_permission: 
audience: internal
sort_order: 310
version: 1
is_published: true
---
# Campos e status do TechProjects
## Projeto
- Nome: obrigatório na criação rápida; descrição contextualiza a entrega.
- Prazo: data prevista; não comprova conclusão. Horas planejadas: estimativa, não apontamento aprovado.
- Situação: planning (Planejamento), active (Execução), on_hold (Em espera), done (Concluído), cancelled (Cancelado).
## Organização e tarefa
Espaço agrupa pastas e listas; a lista oferece quadro, lista, calendário, linha do tempo e carga de trabalho. Tarefa tem título, prazo, responsável e os campos expostos na ficha; checklist, tags, dependências e campos personalizados são complementos. Status de lista são gerenciáveis: não há catálogo universal a presumir para todas as listas.
## Apontamento
- Projeto e atividade identificam onde o trabalho ocorreu. Atividade pode ser criada por título de 2 a 200 caracteres quando autorizada.
- Data, início e término representam intervalo; término deve ser posterior ao início no mesmo dia. Duração isolada não inventa horário.
- Duração manual: inteiro entre 60 e 86.400 segundos. Entrada aceita formas como 1h30, 1:30, 90m, 1.5 e 1,5 no parser de duração.
- Descrição: até 2.000 caracteres. Faturável é uma marca de elegibilidade, não uma cobrança.
- Status: draft (Rascunho), submitted (Enviado), approved (Aprovado), rejected (Devolvido), locked (Travado).
- Origens: Manual, Cronômetro, API, Integração e Importação. Travado com origem Importação é histórico e não equivale a aprovado.
- Alertas: sem horário/sobreposição não verificável, limite diário excedido, sobreposição e horário local ambíguo na troca de horário de verão. Alerta requer revisão, não correção silenciosa.
## Entrega
Farol green/Verde, yellow/Atenção, red/Crítico; evolução percentual; previsão; título e resumo macro. Visibilidade internal/Interno ou commercial/Visível ao comercial. Checkpoint manual difere de evento automático.
## Aprovação, aceite e fechamento
Aprovador é nomeado. Aceite registra resultado, pessoa que aceitou, e-mail opcional, referência opcional e evidência. Competência fechada impede gravação até reabertura autorizada. Meta vem de jornada do People; sem jornada, a meta é desconhecida.
## Tarifas e finanças
Tarifa tem tipo, escopo/alvo, unidade, moeda, valor e vigência com início inclusivo e fim exclusivo. Motivo tem mínimo de cinco caracteres. Custos sem tarifa válida são desconhecidos. No financeiro, medido, aprovado, lançado e recebido não são sinônimos.
## Relacionados
[Registrar horas](/ajuda/projects/operar-my-hours) · [Permissões](/ajuda/projects/permissoes)
