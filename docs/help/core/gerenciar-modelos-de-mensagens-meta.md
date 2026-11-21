---
module_key: core
slug: gerenciar-modelos-de-mensagens-meta
title: Gerenciar modelos de mensagens Meta
summary: Crie, consulte, altere e exclua modelos oficiais das contas WhatsApp Business conectadas.
article_type: howto
route_pattern: /settings/whatsapp-templates
min_permission: system.whatsapp_templates.view.workspace
audience: internal
sort_order: 44
version: 1
is_published: true
---

# Gerenciar modelos de mensagens Meta

**Para que serve:** Administrar os modelos oficiais de mensagens na Meta para as contas WhatsApp Business conectadas ao workspace. Criar ou alterar um modelo não envia mensagens nem o aprova automaticamente.

**Quem pode fazer:** Membro ativo do workspace, com `system.whatsapp_templates.view.workspace`, `system.channels.view.workspace` e `system.whatsapp.view.workspace`. Criar, editar e excluir exigem, respectivamente, `system.whatsapp_templates.create.workspace`, `system.whatsapp_templates.update.workspace` e `system.whatsapp_templates.delete.workspace`. Negação explícita prevalece. Sessão somente leitura não altera modelos.

**Onde fica:** Configurações > Integrações > Modelos de mensagens Meta (`/settings/whatsapp-templates`). Há atalhos em Canais de atendimento, na conexão WhatsApp e em Modelos e canais da central de notificações, conforme seu acesso.

**Antes de começar:** Confirme o workspace, a conexão e os números. Os modelos pertencem à conta WhatsApp Business (WABA) e são compartilhados pelos números dessa conta. Credenciais permanecem no servidor. A integração precisa ter acesso de gerenciamento de modelos na Meta.

## Passo a passo

### Consultar e conferir o conteúdo

1. Abra **Modelos de mensagens Meta** e escolha a conta com os números conectados.
2. Confira o aviso da conta compartilhada. O número ajuda a escolher a conta; não cria um catálogo exclusivo por telefone.
3. Use **Atualizar da Meta** para buscar o estado atual. A tabela mostra nome, idioma, categoria e status recebidos do provedor.
4. Filtre por nome/conteúdo, categoria, status ou idioma. Os filtros se aplicam aos modelos carregados. Quando disponível, use **Carregar mais modelos** para continuar a consulta.
5. Clique no nome ou em **Conferir** para abrir a prévia e os componentes. Um modelo avançado não suportado pelo editor continua íntegro e somente para consulta; use **Gerenciador da Meta** para alterar esse formato.

<!-- screenshot: tabela de modelos e seleção da conta com números fictícios -->

### Criar um modelo

1. Escolha a conta e clique em **Novo modelo**.
2. Informe um nome único, com letras minúsculas, números e sublinhado, e o código de idioma, por exemplo `pt_BR`.
3. Escolha a categoria: **Utilidade**, **Marketing** ou **Autenticação · copiar código**. A categoria final depende da classificação da Meta.
4. Para utilidade/marketing, preencha corpo, cabeçalho e rodapé opcionais e os botões necessários. Informe exemplos fictícios para cada variável. O formato posicional usa `{{1}}`, `{{2}}`; o nomeado usa nomes como `{{nome}}`, quando suportado pela conexão.
5. Para autenticação, configure o modelo padronizado com botão de copiar código. O texto final é gerado pela Meta no idioma indicado.
6. Se usar cabeçalho de imagem, vídeo ou PDF em conexão direta Cloud API, informe o ID público do aplicativo Meta, escolha uma amostra fictícia e clique em **Enviar amostra para a Meta**. PNG/JPEG têm limite de 5 MB; PDF/MP4, 16 MB nesta central. O envio da amostra não envia uma mensagem.
7. Confira a prévia. Clique em **Criar modelo na Meta**. Leia a confirmação e consulte o catálogo novamente para acompanhar a análise.

<!-- screenshot: formulário de criação e prévia com dados fictícios -->

### Editar ou criar uma nova versão

1. Abra a ação **Editar** de um modelo elegível na conexão direta Cloud API.
2. Confira a conta, o nome, o idioma e o estado. Nome e idioma não são alterados nessa operação.
3. Altere os campos suportados, confira os exemplos e envie a alteração à Meta. Uma edição pode exigir nova análise e interromper o uso do modelo aprovado.
4. Para preservar o anterior, use **Duplicar** e dê outro nome. Modelos com mídia exigem uma nova amostra ao criar a cópia.
5. No conector Lovable, a alteração no mesmo modelo não é suportada. Use **Nova versão** para criar uma cópia com novo nome; o modelo anterior é preservado. Variáveis nomeadas e upload de amostras de mídia não estão disponíveis nesse conector pela central.

### Excluir um modelo

1. Clique em **Excluir** na variante correta.
2. Aguarde a conferência do alcance e leia os nomes, idiomas e ID apresentados. A exclusão pode impedir campanhas, sequências e notificações que dependem desse modelo; o histórico de mensagens não é apagado.
3. Na conexão Cloud API, a exclusão identifica a variante pelo ID. No conector Lovable, a operação por nome exclui **todos os idiomas desse nome** na conta; confirme explicitamente essa abrangência.
4. Digite a identificação completa solicitada e clique em **Excluir modelo na Meta**. Para desistir, use **Cancelar exclusão**.
5. Confira o resultado e atualize o catálogo. Se a conferência detectar mudança no conjunto de variantes, a operação é recusada para nova revisão. Essa conferência é um retrato: na exclusão por nome, a Meta considera os idiomas existentes quando processa a operação, inclusive alterações concorrentes.

## Resultado esperado

O resultado da operação é exibido com o retorno do provedor e o catálogo pode ser consultado novamente. Modelo criado, editado ou pendente não significa aprovado nem enviado. A lista de envio de cada área continua aceitando somente modelos elegíveis e aprovados.

## Regras e limites

- A aprovação, recusa, pausa, desativação e eventual reclassificação de categoria são decisões da Meta. Não existe aprovação local que as substitua.
- Uma alteração afeta a WABA escolhida e seus números compartilhados. Não presuma que afeta somente o número usado na seleção.
- O formulário aceita os formatos suportados e valida exemplos e variáveis. Componentes avançados não reconhecidos não são truncados nem regravados pelo editor.
- As ações exigem autorização atual no workspace e na conta. Alterar usuário/workspace não transporta permissões ou rascunhos. Não insira tokens ou segredos no nome, texto, exemplos, amostras ou chamados.
- A amostra fica vinculada ao contexto autorizado e expira; se necessário, envie uma nova amostra. O ID do aplicativo é público e é solicitado somente para o upload, não uma nova credencial.
- A central não ativa campanhas, regras, consentimentos ou disparos. Envios continuam sujeitos à janela aplicável, consentimento/saída, bloqueios, qualidade, cotas e orçamento.
- A NOTIFICA-CENTRAL aceita somente modelos UTILITY compatíveis com seu texto neutro. Um modelo de marketing aprovado pode aparecer nesta central de administração e continuar inelegível para notificações.
- Após alterações, consulte novamente o modelo na campanha, sequência ou central de notificações antes de novos envios.

## Erros comuns

- **Sem permissão:** confira membro ativo, workspace e chaves da consulta/ação. Não tente contornar a restrição por URL direta.
- **Falha na consulta:** não equivale a catálogo vazio. Leia a mensagem e use a ação de nova consulta.
- **Modelo mudou na Meta:** atualize a lista e reabra a operação para conferir o conteúdo e o alcance atuais.
- **Edição indisponível:** o status, os componentes ou o transporte não permitem essa alteração. Use uma nova versão ou o Gerenciador da Meta.
- **Amostra recusada:** confira tipo/tamanho do arquivo, ID do aplicativo, conexão escolhida e permissão de gerenciamento na Meta. Não use documentos reais como amostras.
- **Modelo não aparece para envio:** confira status APPROVED, idioma, categoria e compatibilidade com a função de envio. A aprovação pode levar tempo e o provedor pode reclassificar o modelo.

## Relacionados

- [Administrar canais de atendimento](/ajuda/core/administrar-canais-de-atendimento)
- [Consultar a conexão do WhatsApp](/ajuda/core/consultar-a-conexao-do-whatsapp)
- [Configurar notificações no WhatsApp](/ajuda/core/configurar-notificacoes-no-whatsapp)
- [Enviar modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)
