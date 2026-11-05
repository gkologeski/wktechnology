# Etapa 6 — ciclo de vida e conciliação assistida

## Conciliação assistida

A central existente `/projects/settings/imports/reconciliation?tab=review` recebe a aba Lotes assistidos. A aba Negócios continua sendo a porta canônica para vínculos comerciais: não se deduz negócio/contrato por nome nem se cria outro projeto durante a conciliação.

Prévia somente leitura de até 100 registros por página; apontamentos limitados a até 94 dias por consulta. Empresas vêm da FK da origem sem conflito entre provedores/mapeamentos. Pessoas exigem e-mail único dos dois lados, identidade coerente e ausência de vínculos contraditórios; alocação exige uma única vigência compatível com pessoa e projeto. Ausência de evidência mantém o registro na revisão existente. Não são alterados bruto, staging, duração, situação de aprovação, faturamento ou acesso de pessoas.

Aplicação exige seleção explícita, chave `techprojects.reconciliation.manage.workspace`, administrador ativo no workspace ativo e ausência de modo somente leitura. O banco recalcula a evidência e compara a prévia completa e o `xmin` da origem sob trava. Uma alteração invalida a seleção inteira; não existe aplicação parcial silenciosa. ID de lote torna repetição idempotente somente para a mesma seleção.

A aplicação usa a trilha nativa `project_link_batches`/`project_link_changes`; `project_link_review_rows` guarda o grupo de campos de cada registro e sua versão após o vínculo. Reversão compara todos os valores e a versão antes de alterar a linha uma única vez. Qualquer edição posterior, inclusive editar e voltar ao valor anterior, impede a reversão daquela linha. O caminho legado de reversão encaminha lotes assistidos para essa mesma proteção e recusa desvinculação ampla que os alcance. Reversão de dados é auditada; não apaga a trilha.

Operação administrativa de manutenção: o lote é curto e a aplicação bloqueia gravações concorrentes em apontamentos e nas fontes de evidência durante a transação para impedir decisões baseadas em identidades que mudaram. Limite de 100 e timeout de 15 segundos; erro reverte todo o lote. Fazer lotes fora dos horários de maior uso se necessário. A prévia não obtém esse bloqueio e pode ser invalidada por alterações legítimas.

A tabela auxiliar não concede leitura/escrita direta ao navegador; RPCs verificam workspace, chaves, negações e membership atuais. Histórico da aba retorna só 20 resumos, sem recarregar a central inteira nem expor a seleção completa de cada lote.

## Aceite

Testes PostgreSQL descartável carregam as funções reais da nova migração, sem conexão com URLs de produção. Cobrem cinco cenários distintos de autorização, fontes ambíguas/alteradas, manipulação da prévia, concorrência/idempotência, reversão agrupada, ABA, preservação de horas e bloqueio de escrita direta no diário. Os claims são fixture SQL; isso não representa login GoTrue nem aceite visual com sessão real.

O ensaio do schema e da consulta em produção é executado em transação com ROLLBACK. Nenhum lote histórico é aplicado automaticamente ao publicar. A escolha dos vínculos reais é uma decisão operacional posterior do administrador na tela.
