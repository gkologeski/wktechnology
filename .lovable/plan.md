# Excluir perfis, erro ao marcar reunião e histórico no negócio errado

## 1. Excluir perfis de vaga
- Botão "Excluir" em cada perfil do quadro Vagas e perfis (lista e ficha), com confirmação do sistema.
- Liberado só para quem pode editar o negócio; perfis já encaminhados ao TechHire não podem ser excluídos (mostrar o motivo) para não quebrar a vaga criada.
- A exclusão é arquivamento: some da tela, mas o histórico e as versões aprovadas continuam guardados. Pedidos de validação pendentes daquele perfil são cancelados.
- Exclusão confirmada pelo servidor (nunca mostra "excluído" se nada mudou).

## 2. Erro "meetings_assigned_to_fkey" ao marcar reunião (causa confirmada)
Na tabela de reuniões o campo "dono" guarda o workspace, não a pessoa. Uma regra automática do banco copia esse valor para "responsável" quando ele vem vazio; como o workspace não é um usuário, o banco recusa e aparece o erro da Eduarda (afeta qualquer pessoa que marque reunião por essa janela).
Correção:
- Ao criar reunião, o servidor preenche o responsável com quem está marcando.
- Ajustar a regra automática para, na tabela de reuniões, usar quem criou e não o workspace (migração aditiva, sem apagar dados).
- Mensagem de erro em português caso algo ainda falhe.

## 3. Histórico do Kingitbr no negócio da DataBite (causa a confirmar)
Dados reais: logo após a falha, às 08:15, foi criada uma *tarefa* "Reunião de apresentação: WK Technology & Kingitbr" ligada ao negócio OS/DataBite, ao contato Mathias Almeida e à empresa DataBite. Existe o negócio HT/Kingitbr/Erbely Silva, que não recebeu nada.
Hipótese principal: a janela flutuante de atividade reaproveitou o vínculo de uma janela/rascunho aberto antes na DataBite.
Passos:
- Reproduzir no navegador: abrir DataBite, abrir janela de tarefa, ir ao Kingitbr e criar atividade; conferir a quais registros fica ligada.
- Corrigir para que cada janela mostre claramente a qual registro será vinculada e nunca herde o vínculo de outro registro; ao abrir em outro registro, criar janela nova.
- Mover a tarefa existente para o negócio/contato/empresa do Kingitbr, somente após você confirmar.

## Testes
- Teste automático: reunião criada fica com o responsável correto; perfil encaminhado não pode ser excluído.
- Navegador: marcar reunião sem erro; excluir perfil; criar atividade alternando entre dois negócios e conferir vínculo.
- Não envia convites reais nem publica.
