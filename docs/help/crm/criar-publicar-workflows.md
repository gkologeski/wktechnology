---
module_key: crm
slug: criar-publicar-workflows
title: Criar e publicar workflows
summary: Salve um rascunho, publique uma versão e acompanhe execuções de automações.
article_type: howto
route_pattern: /settings/workflows
min_permission: system.workflows.manage.workspace
audience: internal
sort_order: 413
version: 6
is_published: true
---

# Criar e publicar workflows

**Para que serve:** Configurar automações, separando o rascunho da versão publicada.
**Quem pode fazer:** Membro ativo autorizado a criar ou editar workflows no workspace. Cada ação continua exigindo suas permissões; escolher um destinatário não concede acesso ao registro nem permissão para aprovar.
**Onde fica:** Menu > TechSales > Otimizar > Workflows (`/settings/workflows`).
**Antes de começar:** Defina o gatilho e as ações. Se houver distribuição, crie a regra antes.

## Passo a passo

1. Abra a aba "Workflows".
2. Crie ou abra um workflow. O editor mostra "Novo workflow" ou "Editar workflow"; preencha o nome.
3. Configure o gatilho e as etapas.
4. Salve o rascunho.
5. Clique em "Salvar rascunho" para guardar sem ativar, ou em "Salvar e publicar".
6. Abra "Execuções recentes" para carregar o histórico, independente da lista de workflows.
7. Abra "Política de envio" para revisar regras de envio.
8. Em decisão pendente, preencha "Comentário da decisão (opcional)" e aprove ou rejeite.
   ![Tela: abas Workflows, Execuções recentes e Política de envio](/help-media/crm/criar-publicar-workflows.webp)

### Configurar quem recebe uma notificação

1. Adicione ou abra o passo **Enviar notificação**.
2. Preencha **Título** e, se necessário, **Corpo (opcional)**. Evite informações sensíveis. Quando houver variáveis, o aviso será convertido em uma mensagem neutra; consulte os detalhes no TechERP. O conteúdo privado da execução não será reproduzido para o destinatário.
3. Em **Quem recebe o aviso**, escolha uma regra:
   - **Executor do workflow:** usuário definido para executar a automação. Não significa necessariamente a pessoa que abriu o editor.
   - **Membro específico:** escolha uma pessoa pelo nome na lista de membros disponíveis.
   - **Responsável pelo registro** ou **Criador do registro:** o vínculo atual é resolvido na origem, durante a execução.
   - Em Pessoas, **Gestor da pessoa**; em Negócios, **Líder da equipe do negócio**; em Vagas, **Gestor da área de recrutamento**.
   - Em Contratos, **Aprovadores da etapa atual**.
   - Em Projetos, tarefas ou marcos de projeto, **Membros do projeto**.
4. Use **Adicionar destinatário** para combinar regras, até o limite de dez. A mesma pessoa recebe um único aviso por ocorrência, mesmo quando atende a mais de uma regra.
5. Para retirar uma regra, use o botão de remover correspondente. Mantenha pelo menos uma.
6. Salve o rascunho e revise antes de publicar a versão, conforme as permissões do workspace.

Somente membros ativos do mesmo workspace e com leitura atual do registro podem receber. Se faltar um responsável, a alçada estiver ausente ou o líder da equipe for ambíguo, o sistema não escolhe outro membro nem encaminha automaticamente ao CEO. Consulte o resultado em **Execuções recentes** e regularize os vínculos com a pessoa autorizada.

Destinos avançados que já estejam salvos, como equipe, cargo ou seguidores, são preservados para revisão. Este formulário ainda não oferece sua configuração completa. Um destino preservado só recebe quando existe uma fonte válida e a autorização é confirmada; seguidores sem uma fonte disponível não recebem avisos.

## Resultado esperado

"Rascunho salvo — publique para ativar"; "Publicado — v…"; "Aprovado — retomada enfileirada".

## Regras e limites

Salvar não é publicar. Aprovar ou rejeitar muda o andamento da execução.

- Abrir um fluxo antigo não regrava seus destinatários. O membro específico já salvo continua sendo considerado; na ausência de seleção, o padrão legado é o executor do workflow.
- Resolver um destinatário não transfere responsabilidade, concede acesso, altera alçada ou aprova o registro. Ler o aviso também não conclui a tarefa.
- Sem escolha explícita de canais, **Enviar notificação** mantém o aviso no aplicativo. A opção de entrega permite No app, e-mail e WhatsApp conforme a política do workspace. WhatsApp exige número Cloud API e modelo neutro aprovado, consentimento pessoal e limites. O fallback de e-mail só se aplica quando selecionado e permitido; resultado incerto não dispara alternativa. Consulte [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes).
- Desativar **No app** no grupo **Workflows**, nas preferências pessoais, suprime novos avisos desse passo. O histórico já gravado permanece disponível.
- Uma linha visível pode conter campos privados. O aviso não reproduz variáveis do contexto da execução. Títulos e corpos estáticos são mantidos; não escreva valores, documentos pessoais ou outros dados sensíveis diretamente nesses textos.
- Nem toda origem possui ficha própria. Alguns avisos podem abrir a lista do módulo ou a ficha associada; pode ser necessário escolher uma aba ou localizar o item. Sem rota interna comprovada, o aviso pode permanecer sem link. Isso não concede acesso adicional nem cria uma nova tela.

## Erros comuns

- "Erro ao salvar": revise o rascunho.
- "Erro ao publicar": confira a configuração.
- "Erro no teste": revise o registro de teste.
- "Erro ao remover": confira sua autorização.
- "Não foi possível carregar os workflows": clique em "Tentar novamente"; a falha não significa que não existem automações.
- "Não foi possível carregar as execuções recentes": tente novamente nessa aba. A lista e a edição dos workflows continuam disponíveis.
- "Estatísticas indisponíveis": os totais de 24 horas não puderam ser consultados; não são apresentados como zero.
- **Notificação bloqueada: não há destinatário elegível:** confira responsável, criador, equipe, gestor ou aprovador da origem. A pessoa precisa estar ativa no workspace e ter leitura atual do registro; o sistema não cria um destinatário alternativo.
- **Nenhum membro disponível para seleção:** aguarde o carregamento ou confira os membros com quem administra o workspace. Não é necessário digitar UUID.
- **O aviso não chegou:** confira o resultado da execução e **No app** no grupo **Workflows**. A preferência pode suprimir o novo aviso sem retirar os anteriores.
- **O título ficou neutro:** há variáveis no título ou no corpo. Consulte os detalhes no TechERP, pelo destino disponível para a origem; essa proteção evita reproduzir dados privados para outro usuário.

## Relacionados

- [Criar regras de distribuição](/ajuda/crm/criar-regras-de-distribuicao)
- [Erros comuns](/ajuda/crm/erros-comuns)
- [Revisar preferências de notificações](/ajuda/core/revisar-preferencias-de-notificacoes)
