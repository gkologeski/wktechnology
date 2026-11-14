# Encaminhamentos comerciais → Jurídico → Financeiro → Assinaturas

Entrega: três encaminhamentos duráveis disparados pelas transições reais das origens. Proposta aceita e assinada/fechada abre minuta canônica; minuta aceita atribui a preparação contratual ao Financeiro; cadeia de aprovações integralmente concluída atribui o envio dos convites. O envio externo continua dependente de seleção dos signatários e confirmação humana.

Responsáveis iniciais WK: Sabrina (Jurídico), Aline (Financeiro e assinatura), Guilherme (operador autorizado e escalonamento). Um dia útil por etapa, sábados/domingos excluídos, fuso configurável, sem calendário de feriados. Configuração editável no mesmo ambiente dos aprovadores de minuta; não altera alçadas legais existentes.

Persistência: fila transacional por origem/ciclo, idempotência e tarefas vinculadas ao negócio. Worker existente de workflows verifica fontes/permissões atuais, cria tarefas/notificações e confere conclusão. Impedimentos ficam explícitos e são escalados; vencimento avisa responsável e escalonamento uma vez. Sem efeito de negócio em GET; reprocessamento explícito protegido. Nada de ativar workflow rascunho ou reescrever fluxos legados genéricos.

Segurança: memberships ativos, deny preservado, workspace/source validado, tarefas controladas pela verdade das origens, funções internas não executáveis pelo usuário. Configuração com chave própria e sem concessão global. Pacote local mínimo para Aline operar as etapas, sem conceder revisão jurídica nem administração de usuários.

Validação: SQL real descartável, três transições, duplicidade/concorrência, dois workspaces, ausência de permissão/deny/inativo/readonly, fuso/fins de semana, fonte retirada/aprovação incompleta, bloqueios de tarefa e falha/envio parcial. Tipos/lint/Ajuda e CI integral, build/performance, migração, publicação com hash e aceite autenticado sem convites reais a clientes.

A cadeia interna existente também recebe tarefas/avisos: Jurídico primeiro, Financeiro somente após o Jurídico. Não reduz nem aprova a cadeia; usa a geração ativa e cancela tarefas de aprovações substituídas. O SLA de cada departamento também se aplica à sua aprovação interna.
