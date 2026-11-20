---
module_key: projects
slug: operar-ficha-projeto
title: Operar a ficha do projeto
summary: Operar a ficha do projeto no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/$id
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 10
version: 4
is_published: true
---

# Operar a ficha do projeto

**Para que serve:** A ficha reúne as operações do projeto sem misturar aprovação de horas com situação da entrega.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo

1. Abra um projeto na listagem e confira sua origem e os indicadores.
2. Na aba Tarefas, consulte as colunas e abra uma tarefa; para criar, informe título e prazo quando aplicável.
3. Na aba Marcos, consulte ou cadastre nome e prazo; valores dependem da permissão correspondente.
4. Use Timesheet para consultar ou registrar data, horas e descrição conforme acesso. Em Membros, selecione usuário e papel; tarifas só aparecem quando autorizadas.
5. Abra as telas de acompanhamento de entrega, horas e aprovação ou financeiro quando precisar dessas operações específicas.

## Resultado esperado

A ficha reúne as operações do projeto sem misturar aprovação de horas com situação da entrega.

## Regras e limites

Tarefas, marcos e membros têm controles próprios. Custo/h e Bill/h são dados sensíveis. Indicadores de rentabilidade não substituem medição nem recebimento.

## Erros comuns

- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados

- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Operar a ficha do projeto](/help-media/projects/operar-ficha-projeto.webp)

## Atualização de navegação e consistência

**Progresso informado** é o percentual cadastrado no projeto; não é a conclusão das tarefas calculada no Dashboard. Os dois indicadores têm significados distintos.

## Abrir projetos e marcos pela central

Avisos de projeto abrem esta ficha respeitando acesso atual. O endereço com `tab=milestones` seleciona a aba **Marcos**; quando também contém um `milestoneId` válido e autorizado, a linha recebe o destaque **Marco do aviso**. Se o marco não estiver disponível, aparece um aviso sem criar ou concluir registros. As abas e ações mantêm suas permissões próprias.

Em Central de notificações > Regras > TechProjects, **Projeto iniciado** considera somente Planejamento → Ativo; criação/importação já ativa, retomada Em espera e data prevista não equivalem a esse início. **Projeto atrasado** considera Planejamento ou Ativo com vencimento após a publicação, no dia civil seguinte ao prazo em São Paulo, uma ocorrência por prazo e regra. **Marco próximo do prazo** exige Pendente ou Em andamento, sem conclusão, com projeto em Planejamento, Ativo ou Em espera; a antecedência é de 1 a 365 dias, inicialmente 30 editáveis. Não inclui marcos vencidos, não conclui nem cobra. [Configure a regra e suas preferências](/ajuda/core/usar-central-de-notificacoes).

O custo planejado continua nas telas financeiras autorizadas; os avisos do projeto e seus históricos não carregam esse campo.

Início e prazo do projeto, prazo da tarefa e prazo do marco são datas de calendário. A ficha preserva esses dias sem convertê-los em horários. No celular, as abas se acomodam à largura disponível.
