---
module_key: core
slug: configurar-notificacoes-no-whatsapp
title: Configurar avisos oficiais por WhatsApp
summary: Prepare remetente e modelo, autorize seu telefone e acompanhe os recibos dos avisos da central.
article_type: howto
route_pattern: /notifications
min_permission:
audience: internal
sort_order: 150
version: 3
is_published: true
---

# Configurar avisos oficiais por WhatsApp

**Para que serve:** Receber avisos pessoais dos Workflows pela conexão oficial Cloud API. O aviso usa um modelo neutro aprovado, com acesso à central autenticada. Os detalhes do registro continuam no TechERP.

**Quem pode fazer:** A configuração exige membro ativo, acesso às configurações de notificações e às permissões do canal WhatsApp. Cada usuário autoriza somente o próprio telefone. A leitura e a execução de tarefas continuam sujeitas ao acesso ao registro de origem.

**Onde fica:** **Central de notificações > Modelos e canais**, **Preferências** e **Entregas**. A conexão dos números é preparada na área de canais de atendimento.

**Antes de começar:** Confirme o workspace ativo. O número remetente precisa pertencer à conexão oficial do workspace, estar ativo, com webhook verificado e qualidade sincronizada alta. Prepare no painel da Meta um modelo adequado à notificação solicitada; a prévia do TechERP não cria nem aprova modelos.

## Passo a passo

### Preparar o remetente e o modelo

1. Abra **Modelos e canais**. Confira o remetente, seu status e a qualidade sincronizada. Um número com qualidade reduzida, desconhecida ou conexão indisponível não é elegível para esses avisos.
2. Selecione o remetente na política. Aguarde a consulta dos modelos desse número. Falha de consulta aparece como erro; não significa catálogo vazio.
3. Na prévia **WhatsApp**, escolha um modelo. Confira nome, idioma, status Meta e categoria. A central aceita somente **APPROVED**, **UTILITY** e conteúdo compatível com seu formato neutro.
4. Confira a prévia resolvida. Ela mostra o texto com os valores previstos, o cabeçalho, o rodapé e o botão quando presentes. Modelos pendentes, pausados, de marketing ou incompatíveis não apresentam uma prévia enviável.
5. Defina cota diária, moeda, custo unitário estimado e orçamento estimado. Esses controles reservam um limite local; não são faturamento e não aumentam os limites da Meta. Consulte os valores vigentes no provedor.
6. Habilite WhatsApp e salve. Aguarde a confirmação. Uma gravação concorrente exige recarregar e revisar a política; o sistema não sobrescreve automaticamente outra sessão.

### Autorizar seu próprio telefone

1. Abra **Preferências**. Confira seu telefone com código do país. Use o controle de telefone para atualizar o perfil quando necessário.
2. Leia a finalidade e registre sua autorização. Ela vale para seus avisos desse workspace e para esse telefone. O registro não comprova posse por SMS.
3. Para interromper os avisos, revogue a autorização. A revogação continua disponível se o telefone tiver sido removido ou alterado.
4. Qualquer alteração do telefone do perfil revoga as autorizações anteriores em todos os workspaces, inclusive quando feita por outra tela autorizada. Voltar ao número antigo não restaura o consentimento; autorize novamente quando desejar.

### Interromper somente um grupo ou evento

1. Na central, abra **Preferências**. Use a coluna **WhatsApp oficial** nos grupos ou escolha um item em **Exceção por evento**.
2. Escolha **Bloquear pela preferência** para interromper esse canal no grupo ou evento. O bloqueio específico do evento é aplicado mesmo quando sua autorização pessoal para WhatsApp continua vigente.
3. **Herdar autorização pessoal** remove a escolha naquele nível e volta a usar o grupo, quando existir, ou a autorização pessoal deste workspace. **Permitir pela preferência** é somente uma escolha de canal: não registra nem restaura consentimento, não habilita uma política e não publica ou ativa regras.
4. Clique em **Salvar preferências do workspace** e aguarde a confirmação. A escolha por evento prevalece sobre a do grupo. Os demais canais e eventos permanecem com suas escolhas.

A autorização pessoal continua vinculada ao seu usuário, workspace, telefone, finalidade e versão. Para interromper todos os avisos por WhatsApp neste workspace, use **Revogar autorização**. Bloquear um evento não revoga a autorização dos outros, não cancela uma obrigação e não impede a consulta do histórico. O envio confere novamente a preferência e a autorização antes de transmitir; uma mensagem já transmitida não é recolhida por esta escolha.
5. A exclusão e a recriação de um perfil também não restauram uma autorização antiga.

### Associar ao Workflow e acompanhar

1. Na regra autorizada, use **Enviar notificação**, escolha os destinatários e marque WhatsApp entre os canais. A política do workspace e a autorização pessoal precisam estar válidas na execução.
2. Se desejar e tiver autorização, configure a alternativa de e-mail. Ela depende da própria elegibilidade e preferência do e-mail. Um resultado incerto ou uma restrição de limite/reputação não dispara essa alternativa.
3. Salve e publique a versão da regra pelo fluxo habitual de Workflows. Configurar o canal ou visualizar o modelo não envia mensagem.
4. Abra **Entregas** e filtre por WhatsApp. **Aceito pelo provedor** comprova aceitação do envio; **Entregue** e **Lido** dependem dos recibos correspondentes. A ausência de leitura não significa falha.
5. Use a atualização do histórico ou retorne à tela para consultar o estado atual. A visão do workspace exige permissão específica e acesso atual à origem.

## Resultado esperado

O aviso é enviado somente pelo remetente e pela conexão fixados para a tentativa, com o modelo validado novamente antes do envio. Os recibos assinados atualizam o histórico sem fabricar entrega ou leitura, inclusive se a projeção da mensagem na Inbox não tiver sido gravada.

## Regras e limites

- A central usa modelos aprovados também dentro da janela de atendimento. Na regra da plataforma, respostas livres são limitadas à janela de 24 horas; fora dela é necessário modelo aprovado. A seleção do canal não autoriza mensagens promocionais ou conteúdo estranho à finalidade solicitada.
- A categoria UTILITY é conferida no catálogo. Texto neutro, isoladamente, não garante classificação ou aprovação pela Meta. Mudança de categoria, idioma, componentes ou qualidade pode bloquear o envio.
- As cotas e os custos locais são conservadores e estimados. Os limites oficiais podem ser compartilhados entre números de um portfólio; a cobrança final depende das regras e valores vigentes da Meta.
- Um prazo de espera do provedor é respeitado pela conexão, inclusive entre avisos diferentes. A central não troca de número para continuar disparando durante esse bloqueio.
- Uma restrição de qualidade/reputação ou um limite sem prazo seguro pode desligar o WhatsApp da central automaticamente. Consulte **Entregas**, revise a situação na Meta e só então reative o canal em **Modelos e canais** com as permissões necessárias. Isso não libera nem aumenta um limite da plataforma.
- A autorização de telefone, o acesso à origem, a conexão, o modelo, a qualidade e a reserva são conferidos novamente antes do envio. Trocar de usuário ou workspace não transporta rascunhos ou permissões da sessão anterior.
- Recibos históricos corretos podem ser conciliados após o remetente ficar indisponível ou a conexão ser desativada. Essa conciliação não ativa a conexão, não recebe novas conversas por uma conexão desativada e não reenvia a mensagem.
- Recibos de destinatário, remetente, conexão ou workspace divergentes não alteram a entrega. Recibos repetidos não geram outro envio nem regressão do estado.
- Recusas da Meta por número sem WhatsApp ou limitação de engajamento usam o bloqueio canônico de destinatários. O mesmo recibo não deve duplicar esse registro.
- Tentativas antigas sem vínculo de conexão comprovado permanecem incertas; o sistema não inventa esse vínculo nem repete o envio.
- A conexão anterior pelo Lovable mantém seu fluxo existente. Esta entrega não migra contas automaticamente, não cria produtores de todos os eventos planejados e não ativa resumos pessoais.

## Erros comuns

- **Qualidade não é alta:** revise a sincronização e a qualidade da conta na Meta antes de habilitar novos avisos. A regra de exigir qualidade alta é uma proteção local da central.
- **Modelo não elegível:** confira status, categoria, idioma, texto e componentes. Consulte novamente o catálogo depois de corrigir e obter aprovação no provedor.
- **Autorização revogada:** confira o telefone atual e registre nova autorização pessoal se desejar. Outra pessoa não pode consentir por você nessa tela.
- **Conexão mudou:** a tentativa anterior não é redirecionada ao novo remetente. Revise a regra e o histórico.
- **Limite do provedor:** aguarde o prazo indicado e confira o estado do canal. Repetir cliques ou trocar de número não resolve a restrição.
- **Resultado incerto:** não reenvie às cegas. Aguarde conciliação ou confira com o responsável pelo canal.
- **Acesso ou consulta falhou:** atualize o contexto. O sistema não oferece ações sobre dados antigos como se estivessem confirmados.

## Relacionados

- [Central de notificações](/ajuda/core/usar-central-de-notificacoes)
- [Preferências de notificações](/ajuda/core/revisar-preferencias-de-notificacoes)
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Política de mensagens do WhatsApp](https://whatsappbusiness.com/policy/)
- [Categorias de modelos](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)
- [Preços da plataforma](https://whatsappbusiness.com/products/platform-pricing/)


## WhatsApp em resumos e acompanhamentos

Em **Preferências → Receber resumo de notificações**, a adesão começa desligada e nenhum canal vem escolhido. Selecionar **WhatsApp oficial** não cria consentimento: é necessário manter a autorização pessoal válida e a política de resumos habilitada, além das condições do canal. Só comunicações externas iniciais elegíveis e explicitamente de baixa prioridade podem compor o resumo; a central permanece imediata. A aprovação de solicitação profissional, os lembretes e as escaladas não são agrupados.

O resumo usa o mesmo modelo neutro aprovado compatível, sem contagem, título ou dados das origens. Não há fallback automático para e-mail: escolha esse canal separadamente se desejar. Revogar o consentimento ou bloquear o canal impede novos envios elegíveis; habilitar a política ou a preferência não sobrepõe essa decisão.

Lembretes e escaladas exigem configuração explícita publicada e cota de acompanhamento positiva. Herdam os canais e fallback do passo original, revalidam acesso, pendência, consentimento e silêncio e só seguem enquanto o aviso original não foi lido. Eles não executam novamente as outras ações nem alteram a decisão da origem. Um resultado incerto permanece protegido contra repetição e troca de chave.
