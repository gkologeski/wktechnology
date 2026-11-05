# Contratação integrada — etapa 3

## Resultado

A assinatura comercial passa a ser uma evidência vinculada à versão salva do contrato, às partes e ao negócio. A WK pode selecionar explicitamente o contrato comercial de origem, preparar documento no assinador existente ou registrar PDF externo com atestação humana, data real, referência e justificativa. Preparar não envia nem assina. O registro externo não verifica criptograficamente assinaturas do PDF.

Duas permissões novas: `techcontracts.signature_evidence.view.workspace` e `techcontracts.signature_evidence.manage.workspace`. Exigem também escopo do contrato, workspace atual, membership ativo e ausência de deny. Não há concessão automática a todos os cargos. Documentos ficam em bucket privado de até 5 MB; upload somente pelo servidor autorizado, com hash e metadados da versão/ator. Revogação preserva histórico.

## Recrutamento

A capacidade `signature_gate_enabled` é opt-in por workspace. Vagas históricas não governadas são preservadas. Nas governadas, atendimento a cliente exige aprovação atual da demanda, negócio ganho por tipo canônico do pipeline, origem explícita e contrato principal de prestação ativo/renovando, com entidade WK e cliente coerentes, vigência válida e assinatura atual. Contratações internas/gestão compartilhada usam aprovação sem negócio fictício.

O banco revalida novas operações em vagas publicadas, candidaturas, entrevistas, publicações e ofertas, inclusive caminhos de serviço/importação. Cancelamentos permanecem possíveis. A publicação em provedor consulta a autorização antes de chamar o adaptador externo. Workers consultam a candidatura atual depois da autorização delegada; Hunting não gera pessoa, acesso, obrigações internas ou alocação automaticamente. O encaminhamento comercial mantém uma única requisição por perfil e não admite antecipação no workspace ativado.

Alterar conteúdo material do contrato invalida a evidência para novos efeitos, sem apagá-la. Alterar o contrato da demanda gera nova revisão/aprovação. Perfil comercial não pode perder o negócio para se disfarçar de contratação interna.

## Projetos e limites da entrega

A rotina de entrega reutiliza projetos existentes. Novos grupos exclusivamente Hunting não criam projeto de horas. Projetos governados novos permanecem em planejamento até existir assinatura válida; ativação é conferida no banco. Projetos históricos não são convertidos automaticamente.

Esta etapa não implementa as etapas posteriores de admissão, alocação, provisionamento, faturamento ou conciliação histórica. Não atesta documentos reais em nome do cliente, não infere assinatura a partir de `signed_at`/status e não escolhe contrato ambíguo automaticamente. Alterações posteriores exigem avaliação e nova evidência quando materialmente relevantes.

## Verificação e implantação

Migrações aditivas 0309/0310, ensaiadas com rollback na estrutura real. Testes de PostgreSQL descartável executam funções e triggers de produção com fixtures de identidade; isso não equivale a login GoTrue. Incluem permitido, sem chave, deny, outro workspace, inativo, assinatura externa/nativa, alteração/revogação, histórico, Hunting, repetição e origem comercial. Workers têm teste de bloqueio antes de efeitos. Gate final: permissões, tipos, lint, suíte completa, build, limites de performance, CI e hash efetivamente servido nos dois domínios.

Aplicar schema com flag desligada; publicar; ativar somente a WK e verificar leitura autenticada. Nenhum contrato real é assinado ou certificado pelos testes. Desligar a capacidade interrompe a nova regra de negócio, mas não revoga RBAC, evidências ou histórico. Recibos e resultados ficam no relatório privado da execução.
