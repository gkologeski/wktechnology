# Lia: número solto após "essa área fica com você?" = indicação, perguntar o nome

**Estimativa:** porte P, 20–30 min. Sem mudança de banco, permissões ou tela.

## O problema
O Igor respondeu "Boa tarde" + "31 99833-5818" logo depois da pergunta "Essa área fica com você?". Ele quis dizer "fale com quem atende nesse número". A Lia respondeu "Vejo que você enviou um número de telefone…", o que soa robótico e não avança.

## O que muda (complemento no prompt, sem regra em código)
Seguindo sua orientação anterior, o ajuste é feito nas instruções da IA:

1. Na regra de "Indicação recebida", acrescentar: quando a última pergunta da Lia foi sobre quem responde pela área e o cliente responde só com um telefone (sem nome), entender como indicação do responsável. A resposta deve:
   - não descrever nem repetir que recebeu um telefone;
   - agradecer de forma breve e perguntar o nome da pessoa com quem deve falar nesse número (ex.: "Obrigada, Igor! Com quem eu falo nesse número?").
2. Na dica automática que o sistema dá à IA quando há telefone na mensagem: se não houver nome escrito, lembrar que a resposta deve pedir o nome, sem comentar o envio do número.
3. A indicação continua sendo registrada pelo sistema como hoje (lead para revisão); quando o Igor disser o nome, ele é usado no registro.

## Verificação
- Teste com a IA real usando a conversa do Igor: esperado pedir o nome, sem "vejo que você enviou um número".
- Teste de controle: cliente que manda "meu outro número é 31 9…" continua tratado como número próprio.
- Rodar os testes existentes do agente (turn, worker, conversation-state).
- Conversa do Igor atual não é reprocessada automaticamente; se quiser, envio a pergunta do nome manualmente.

## Detalhes técnicos
- `src/lib/prospecting/sdr/agent.server.ts` (linha da regra "Indicação recebida").
- `src/lib/prospecting/sdr/turn.ts` (dica de telefone legível sem nome).
- Atualizar hash em `docs/security/permission-contracts.json` se os arquivos estiverem sob contrato.
