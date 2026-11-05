---
module_key: projects
slug: erros-comuns
title: Erros comuns do TechProjects
summary: Erros comuns do TechProjects no TechProjects: operação, acesso e limites comprovados no código.
article_type: troubleshooting
route_pattern: 
min_permission: 
audience: internal
sort_order: 330
version: 1
is_published: true
---
# Erros comuns do TechProjects
## Registro indisponível ou sem permissão de consulta
Confirme workspace, vínculo ativo e recurso/escopo. A mensagem não permite concluir se o registro foi removido ou está fora da carteira. Solicite revisão de acesso; não tente outra URL para contornar a decisão.
## O horário final deve ser maior que o horário inicial
Corrija início e término. O formulário de intervalo valida o mesmo dia; não use término menor para representar trabalho que atravessa a meia-noite. Revise registros separados por dia quando apropriado.
## Já existe um apontamento neste intervalo
Confira seus registros do dia e elimine a sobreposição real antes de salvar. Não use duração isolada para ocultar o conflito. Sem horário, a verificabilidade da sobreposição é limitada e há sinalização de revisão.
## Informe a atividade realizada
Selecione a atividade existente ou, quando autorizado, informe título válido para criação. Sem atividade elegível o apontamento não é salvo.
## Duração ou descrição inválida
Use duração manual entre 1 minuto e 24 horas e descrição de até 2.000 caracteres. Revise também data, projeto e formato de entrada.
## Envio bloqueado ou prévia desatualizada
Leia os bloqueios da prévia, confira aprovador e política. Mudança de registros pode exigir nova prévia; não repita confirmação antiga.
## Competência fechada
Solicite revisão do fechamento por usuário autorizado. Reabertura exige justificativa; criar por outro caminho, API ou fila local não contorna a competência.
## Importação não produziu registros
Confira se executou apenas prévia, se confirmou a origem e os mapeamentos e se a execução terminou. Resolva pendências e duplicidades antes de repetir; prévia não é gravação definitiva.
## Custo ou capacidade sem cobertura
Confira vigência da tarifa, escopo e jornada. Ausência de dado não deve ser convertida em zero; solicite cadastro ao responsável autorizado.
## Falha de conexão ou pendente local
Revise a fila e a confirmação do servidor antes de reenviar. Armazenado no aparelho não é salvo no ERP; sair apaga a fila local. Nunca envie chaves em capturas ou chamados.
## Relacionados
[Campos e status](/ajuda/projects/campos-e-status) · [Permissões](/ajuda/projects/permissoes)
