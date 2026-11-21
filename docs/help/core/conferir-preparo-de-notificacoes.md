---
module_key: core
slug: conferir-preparo-de-notificacoes
title: Conferir preparo e planejar um piloto de notificações
summary: Confira a configuração publicada, identifique verificações pendentes e prepare um piloto e sua pausa com segurança.
article_type: howto
route_pattern: /notifications
min_permission: system.notification_settings.view.workspace
audience: internal
sort_order: 151
version: 1
is_published: true
---

# Conferir preparo e planejar um piloto de notificações

**Para que serve:** Conferir os dados salvos de uma regra publicada e organizar as verificações necessárias antes de um piloto autorizado. Esta conferência não executa o Workflow, consulta o provedor, resolve destinatários ou registra aceite automaticamente.

**Quem pode fazer:** Membro ativo com acesso à configuração de notificações e leitura do Workflow escolhido, no workspace atual. Alterar política, editar ou publicar regras e consultar entregas continuam exigindo suas permissões próprias. O acesso à origem e aos destinatários é conferido na ocorrência real.

**Onde fica:** **Notificações → Modelos e canais → Conferir preparo publicado** (`/notifications?area=models`).

**Antes de começar:** Confirme a sessão e o workspace ativo e tenha leitura da configuração de notificações e do Workflow escolhido. Para conferir uma configuração publicada, a regra precisa ter uma versão publicada; rascunhos não são usados como substitutos. Publicar, alterar políticas e consultar entregas exigem suas alçadas próprias.

## Passo a passo

1. Abra **Notificações → Modelos e canais**. Em **Conferir preparo publicado**, escolha uma regra visível e solicite a conferência. Se a lista estiver limitada, a tela informa esse limite; ausência na lista não comprova ausência de regras no workspace.
2. Confira a versão publicada e a situação salva. **Rascunhos fora da conferência; compare no editor.** A conferência estrutural das regras pode preferir o rascunho; ela não substitui esta leitura da versão publicada.
3. Leia cada resultado:
   - **Configuração consultada:** a informação foi lida no contexto autorizado, podendo incluir valores padrão de uma política ainda sem gravação explícita. Não significa envio liberado.
   - **Dependência bloqueada:** há uma condição salva incompatível, ausente ou desabilitada. Não habilite canais apenas para fazer o diagnóstico mudar.
   - **Verificação manual pendente:** depende de uma ocorrência, sessão, provedor ou piloto real que esta conferência não executou.
   - **Indisponível:** o dado não pôde ser conferido com o acesso e as condições atuais. Não interprete como zero ou como sucesso.
4. Para examinar modelos WhatsApp, use a ação explícita **Consultar modelos no provedor**. Abrir a aba, escolher uma regra ou conferir preparo não solicita essa consulta. O remetente selecionado e a identidade atual delimitam a consulta. Trocar de contexto exige uma nova solicitação; uma prévia não cria nem aprova modelo na Meta.
5. Revise as pendências no editor, em Preferências ou em Entregas conforme a alçada disponível. Não há botão de enviar, ativar ou aprovar o piloto nesta conferência.

## Resultado esperado

Um retrato autorizado e datado da configuração publicada, com dependências e verificações pendentes explícitas. A interface não apresenta um resultado global de prontidão para envio, aceite de produção ou aprovação do piloto.

## Regras e limites

### Preparar um piloto posterior

A conferência local não autoriza publicação ou implantação. Um piloto real depende de autorização separada e revisão do ambiente publicado, migrações, permissões, canal, cota, consentimento e versão correta do Workflow.

Antes de habilitar uma política, inventarie **outras regras, versões publicadas e entregas pendentes do workspace**. A política é compartilhada: habilitar um canal pode liberar trabalho elegível de outras regras ou do backlog. Não há allowlist, percentual ou isolamento de piloto criado por esta tela. Se não puder conferir esse inventário com seu acesso, encaminhe a revisão a um operador autorizado.

Defina explicitamente a regra e versão, evento futuro elegível, destinatário autorizado, canal, limite conservador, período de observação e responsável pelo acompanhamento. Revise todos os passos do Workflow: ações de tarefa, aprovação, pagamento, mensagem direta ou integração possuem seus próprios efeitos e controles. O piloto de comunicação não deve executar esses efeitos por acidente. Slack é coletivo e exige revisão de seu público; ele não comprova recebimento individual.

Em um piloto autorizado, confira o aviso na central com a sessão real do destinatário, o destino exato e suas permissões. Consulte o histórico do canal: **Aceito pelo provedor** não comprova entrega ou leitura. E-mail sem recibo permanece sem essa prova. Registre separadamente o que foi preparado, executado e efetivamente observado; não marque verificações locais como piloto concluído.

### Planejar a pausa

- Revise quais regras e políticas precisam ser desativadas e quem tem autorização para fazê-lo. Esta tela não altera esses controles.
- Desligar somente WhatsApp pode ainda permitir o fallback de e-mail explicitamente configurado. Considere os outros canais, a política coletiva do Slack e as regras envolvidas.
- Políticas da central não pausam todas as outras ações de um Workflow ou todos os produtores legados. A desativação de uma regra também não recolhe efeitos já executados.
- Trabalho em processamento ou aceito pelo provedor não é recolhido. Resultado **Incerto** não autoriza reenvio, troca de número, nova chave ou fallback como tentativa de reversão.
- Revogar consentimento pessoal impede novos envios elegíveis daquele canal; não apaga o histórico, retira uma obrigação ou recolhe uma mensagem transmitida.

## Erros comuns

- **Sem permissão ou contexto:** confirme a sessão e o workspace. Não procure outro workspace para contornar o bloqueio.
- **Falha de consulta:** tente novamente. Resultados anteriores ficam ocultos durante a revalidação e não permanecem como se estivessem confirmados após erro.
- **Regra sem versão publicada:** revise no editor. Um rascunho não é usado como substituto da configuração publicada.
- **Modelo não consultado:** isso é diferente de catálogo vazio. Solicite a consulta explicitamente quando autorizado; uma falha de consulta permanece uma falha.

## Relacionados

- [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes)
- [Configurar avisos oficiais por WhatsApp](/ajuda/core/configurar-notificacoes-no-whatsapp)
- [Configurar notificações no Slack](/ajuda/core/configurar-notificacoes-no-slack)
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
