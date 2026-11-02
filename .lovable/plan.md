# Remetente de e-mail travado no usuário + contexto multicanal nas IAs

Estimativa: cerca de 1 h 30 min. Porte M.

## 1. Remetente de e-mail nas Sequências
- Nos passos de e-mail, o campo "Conta remetente" já vem preenchido com a conta de e-mail do usuário logado e fica **desativado** (só leitura), com o aviso "Envia pela sua conta".
- Se o usuário não tiver conta de e-mail conectada, aparece o aviso "Conecte sua conta de e-mail em Canais" e o passo não pode ser salvo.
- **Admin/owner** continua vendo a lista completa e pode escolher qualquer conta do workspace.
- O servidor também confere a regra ao salvar: quem não é admin só grava a própria conta. Escolha da tela não basta.
- O passo de WhatsApp não muda.
- Sequências já salvas com outra conta: quem não é admin vê a conta salva, mas ao salvar de novo ela passa para a própria conta (com aviso).

## 2. Contexto multicanal nas IAs (só no prompt)
- Em todas as agentes com versão publicada (Lia, Bruna e demais), criar nova versão publicada com uma regra a mais nas instruções, guardando a anterior para restaurar:
  "Antes de responder, leia todo o histórico disponível do cliente em todos os canais: e-mails, WhatsApp e ligações (transcrições e resumos). Se o cliente responder a uma campanha de WhatsApp, a um e-mail ou depois de uma ligação, entenda o que já foi dito em qualquer canal e continue a partir daí, sem repetir apresentação ou perguntas já respondidas e sem tratar como primeiro contato."
- Nenhuma mudança de código nessa parte, como você pediu.
- Teste no simulador com um caso de resposta após campanha, sem enviar nada.

## Detalhes técnicos
- Arquivos: `sequences-page.tsx` (campo bloqueado/derivado do usuário, papel via permissões existentes), função de salvar rascunho de sequência (validação admin vs. dono da conta), registro em `docs/security/permission-contracts.json` e testes de permissão (permitido, não admin com outra conta, outro workspace, inativo).
- Agentes: nova linha em `sdr_agent_versions` por agente, anterior arquivada.
- Limite conhecido: a regra pede que a IA leia e-mails e ligações, mas ela só enxerga o que o sistema já entrega no histórico. Vou conferir quais canais chegam hoje ao contexto e informar se algum (por exemplo, transcrição de ligação) não chega — sem alterar código, já que a orientação é ficar só no prompt.
- Validação: `permissions:check`, testes, Playwright com a sua conta. Nada publicado.
