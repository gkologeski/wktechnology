---
module_key: core
slug: revisar-preferencias-de-notificacoes
title: Revisar preferências de notificações
summary: Ajuste os grupos de avisos pessoais, o som e o tremor do sino, preservando seu histórico.
article_type: howto
route_pattern: /settings/notifications
min_permission:
audience: internal
sort_order: 148
version: 4
is_published: true
---

# Revisar preferências de notificações

**Para que serve:** Ajustar como os avisos pessoais interrompem sua rotina. A tela reúne os grupos já usados pelas notificações, incluindo aprovações, contratação e Workflows.

**Quem pode fazer:** Usuário autenticado, para as próprias preferências. A tela não permite editar as preferências de outra pessoa nem concede acesso aos registros mencionados nas notificações.

**Onde fica:** Configurações > Notificações (`/settings/notifications`). Também é possível abrir o sino no topo e clicar em **Preferências →**.

**Antes de começar:** Confirme que entrou com seu usuário. As opções são pessoais e não constituem uma regra de envio do workspace.

## Passo a passo

1. Abra **Notificações** e aguarde o carregamento das suas preferências.
2. Localize o grupo de avisos desejado. Estão disponíveis **Menções**, **Atribuições**, **Mudança de fase**, **Tickets**, **Tarefas e encaminhamentos**, **SLA**, **Mensagens e comentários**, **Workflows**, **Aprovações**, **Contratação e perfis de vaga**, **Formulários**, **Carteira** e **Plataforma e segurança**.
3. Ajuste os controles do grupo:
   - **No app:** controla a opção de aviso no aplicativo. Ao desativar, novos avisos desse grupo também deixam de abrir a interrupção na tela, tocar e animar o sino. O histórico já gravado continua disponível.
   - **E-mail:** registra a preferência para os fluxos que já consultam essa opção. Alguns envios antigos de aprovação e automação possuem tratamento próprio; esta opção ainda não interrompe todos esses e-mails.
   - **Som:** permite o aviso sonoro quando uma notificação elegível chega ao sino e o navegador permite áudio.
   - **Tremor:** permite a animação do sino ao receber uma notificação elegível. Não é uma configuração de vibração física do dispositivo.
4. Clique em **Salvar** e aguarde a confirmação **Preferências salvas**.
5. Para conferir o histórico, abra novamente o sino. Ler uma notificação não conclui uma tarefa, aprova uma contratação ou altera uma decisão no registro de origem.

## Resultado esperado

As opções ficam salvas para seu usuário e são consultadas pelos novos avisos do sino. Suas escolhas anteriores dos sete grupos originais são mantidas. Os seis grupos acrescentados começam sem e-mail, som ou tremor habilitados por padrão.

## Regras e limites

- As preferências não apagam notificações, mudam responsáveis, concedem permissão de leitura nem liberam uma etapa de aprovação.
- O passo **Enviar notificação** dos Workflows consulta **No app** do grupo **Workflows** antes de criar um novo aviso. Se essa opção estiver desligada, o envio é suprimido; notificações anteriores não são apagadas.
- Os grupos **Workflows**, **Aprovações**, **Contratação e perfis de vaga**, **Formulários**, **Carteira** e **Plataforma e segurança** começam com **No app** ligado e as demais opções desligadas, salvo se você já tiver uma escolha salva.
- A tela salva somente as opções que você alterou. Valores de canal gravados com formato inválido são tratados como desligados; para uma opção ausente, vale o padrão do grupo.
- Alterar um grupo não cria uma automação, ativa um evento futuro ou habilita um canal externo. Esta tela ainda não oferece controles de WhatsApp, resumos ou horário de silêncio.
- Algumas notificações antigas compartilham um tipo genérico. Por exemplo, **Mensagens e comentários** abrange conversas e comentários de atividades; **Aprovações** reúne diferentes fluxos. O grupo não comprova a origem exata do evento.
- Enquanto você estiver na Inbox, uma mensagem identificada como pertencente à Inbox não gera uma nova interrupção pelo sino. Um comentário de atividade não é tratado automaticamente como mensagem da Inbox.
- Tipos ainda não reconhecidos continuam no histórico, mas não geram pop-up, som ou tremor. A mesma proteção vale enquanto as preferências do usuário atual não tiverem sido carregadas.
- A preferência de e-mail só é aplicada por produtores que já a consultam. O envio próprio de alguns fluxos legados permanece independente; salvar uma opção não comprova envio, bloqueio ou entrega no provedor.
- O passo **Enviar notificação** dos Workflows exige destinatário ativo no mesmo workspace e leitura atual do registro de origem. Um responsável, gestor ou aprovador ausente não é substituído automaticamente pelo CEO. Essa escolha pertence ao workflow e à alçada, não às preferências pessoais. Outros produtores legados permanecem com suas regras próprias.
- Avisos com variáveis usam texto neutro, para não copiar campos privados da execução. Consulte os detalhes no destino disponível para a origem no TechERP; pode ser uma ficha, lista ou registro associado. Ler o registro pode exigir permissões adicionais para determinados campos.

## Erros comuns

- **O e-mail continuou chegando:** verifique qual fluxo realizou o envio. Algumas aprovações e automações existentes não consultam estas preferências; a tela informa esse limite.
- **Não ouvi som ou não vi tremor:** confira **No app**, **Som** e **Tremor** do grupo, a permissão de áudio do navegador e se a mensagem pertence à Inbox já aberta. Um tipo desconhecido ou uma preferência ainda em carregamento permanece silencioso.
- **As preferências foram alteradas em outra sessão:** recarregue a página, confira as opções atuais e salve novamente. Não considere a alteração concluída sem a confirmação.
- **O aviso de Workflow não apareceu:** confira **No app** no grupo **Workflows** e peça a quem administra a automação que revise o resultado da execução e seus vínculos. As preferências não concedem acesso a um registro que não esteja disponível para você.
- Se houver acesso negado, confira a sessão e a autorização da operação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados

- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)

![Tela: capturar /settings/notifications com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-preferencias-de-notificacoes.webp)
