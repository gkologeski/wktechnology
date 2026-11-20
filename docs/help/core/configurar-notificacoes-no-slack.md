---
module_key: core
slug: configurar-notificacoes-no-slack
title: Configurar notificações no Slack
summary: Conecte um canal compartilhado do Slack e habilite avisos neutros pelos Workflows, com limite e histórico.
article_type: howto
route_pattern: /settings/notifications/slack
min_permission: 
audience: internal
sort_order: 149
version: 3
is_published: true
---

# Configurar notificações no Slack

**Para que serve:** Preparar avisos coletivos para um canal do Slack. O Incoming Webhook possui um destino fixo definido no próprio Slack. Esta conexão não identifica usuários individuais do TechERP no Slack.

**Quem pode fazer:** Membro ativo do workspace com acesso à integração. Gravar, conferir e desconectar exigem as permissões específicas da operação. Habilitar a política coletiva também exige consultar e gerenciar as configurações de notificações. Nenhum cargo recebe novas permissões automaticamente.

**Onde fica:** Configurações > Notificações > Slack (`/settings/notifications/slack`) para a conexão; Central de notificações > **Modelos e canais** para a política; **Entregas > Workspace** para o histórico autorizado.

**Antes de começar:** Confirme o workspace ativo e os acessos necessários. Escolha um canal autorizado no Slack; a URL contém um segredo e não deve ser compartilhada.

## Passo a passo

### Preparar a conexão

1. No Slack, crie um Incoming Webhook no canal autorizado para receber os avisos.
2. No TechERP, confirme o workspace ativo e abra a configuração do Slack.
3. Cole a URL oficial `https://hooks.slack.com/services/...` no campo protegido. A URL contém um segredo: não a inclua em prints, chamados ou mensagens. Valores já salvos não são devolvidos ao navegador.
4. Informe nomes de referência para o workspace e o canal. Esses nomes são etiquetas administrativas e não comprovam a identidade nem os participantes do destino.
5. Salve e aguarde a confirmação. **Conferir configuração** verifica a configuração autorizada no TechERP sem enviar mensagens e sem comprovar o recebimento pelo Slack.

### Habilitar avisos pelos Workflows

1. Abra **Central de notificações > Modelos e canais > Slack**. A política começa desligada, inclusive quando já existe uma integração salva.
2. Selecione uma conexão autorizada e defina uma cota diária positiva, de até 10.000 avisos. A cota local não aumenta os limites do Slack.
3. Revise a prévia do modelo protegido: texto neutro e link para a central autenticada, sem títulos, nomes, valores, documentos, menções ou conteúdo do registro de origem.
4. Confirme que o público do canal é adequado e salve a política. Cada pessoa que abrir o TechERP continuará sujeita às próprias permissões.
5. No Workflow, use a ação **Enviar mensagem no Slack**. O gatilho continua configurável no motor existente. Uma ocorrência gera somente um aviso coletivo, sem multiplicá-lo pelo número de destinatários de outra ação.
6. Revise e publique a regra pelo fluxo habitual de Workflows. Salvar a conexão ou a política não publica regras nem envia um aviso de teste.

## Resultado esperado

A conexão e a política ficam salvas no workspace correto. Somente uma regra publicada e elegível pode enfileirar o aviso coletivo. O histórico distingue fila, aceitação, falha e resultado incerto, sem presumir leitura pessoal.

## Regras e limites

### Compatibilidade com configurações antigas

- As conexões e rotas anteriores são preservadas. A lista de rotas fica disponível apenas para consulta: o Incoming Webhook não sobrescreve o canal por evento.
- Ações com canal antigo preenchido ficam bloqueadas. No editor, use **Remover canal antigo**, revise a conexão da política e publique a versão revisada.
- Textos antigos permanecem no rascunho para revisão. O envio ao Slack utiliza apenas o modelo neutro protegido.
- Esta conexão é coletiva. Ela não aparece nas preferências pessoais nem em **Minhas entregas**. E-mail, WhatsApp e avisos no app mantêm suas regras e preferências próprias.

## Conferir o histórico e as falhas

1. Abra **Entregas**, escolha **Workspace** e filtre por **Slack coletivo**. A visão exige permissão de histórico do workspace, acesso atual à origem e à integração.
2. **Na fila** ou **Nova tentativa programada** não comprovam envio. **Aceito pelo provedor** corresponde à resposta `200/ok` do Slack; não comprova leitura, entrega pessoal nem presença dos usuários no canal.
3. O processamento serializa o mesmo endpoint e respeita pelo menos um segundo entre envios. Um `Retry-After` conhecido nunca é encurtado. Limites maiores que o horizonte suportado ou respostas de limite sem prazo válido pausam o endpoint até revisão administrativa da política.
4. **Resultado incerto** preserva falhas em que o provedor pode ter aceitado a mensagem. O sistema não repete automaticamente esses envios.
5. Desativar a regra, alterar o destino, revogar acesso ou desconectar a integração impede novos envios elegíveis. Reservas antigas não são reaproveitadas para outro destino.

Duas URLs diferentes podem apontar para o mesmo canal no Slack; o conector não comprova essa equivalência. Use um único endpoint por canal e acompanhe as respostas de limite. A entrega coletiva não permite desligamento individual pelo TechERP: ajuste a regra ou o público do canal. Para avisos pessoais com preferência individual, utilize **No app**, e-mail ou WhatsApp autorizado.

## Erros comuns

- **Não foi possível carregar:** tente novamente. Uma falha de consulta não significa integração desconectada.
- **Configuração alterada:** recarregue, revise a política atual e salve novamente; o rascunho não deve sobrescrever outra sessão automaticamente.
- **Sem acesso:** confirme membership ativo, workspace, permissão da integração e da origem. Não procure outro registro por URL direta.
- **Política desligada ou cota zero:** a conexão pode estar salva, mas o canal coletivo ainda não está habilitado.
- **Resultado incerto:** consulte o responsável e o provedor antes de repetir; não presuma falha definitiva.

## Relacionados

- [Central de notificações](/ajuda/core/usar-central-de-notificacoes)
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Permissões do Core](/ajuda/core/permissoes)
