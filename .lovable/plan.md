# Lia: reconhecer "não trabalho mais lá" e não insistir em indicação

## Problema (conversa do Andre Luiz Bachmann, 16/10)
O cliente disse "não sei te dizer, pois já faz uns 5 anos que saí da Opentech". A Lia não entendeu que ele não trabalha mais na empresa e pediu o contato de alguém de TI de lá. Hoje a regra de contato errado só reconhece frases como "número errado" ou "não conheço ninguém com esse nome", e nada sobre ter saído da empresa.

## O que será feito
1. **Novo caso "saiu da empresa":** reconhecer frases como "saí da X", "não trabalho mais lá/aí", "faz N anos que saí", "não faço mais parte", "fui desligado", "me aposentei", "mudei de empresa".
2. **Resposta da Lia nesse caso:**
   - Se a pessoa **já disse que não sabe** ou não tem contato ("não sei", "perdi o contato"): agradecer, pedir desculpas pelo incômodo e encerrar, **sem pedir indicação**.
   - Se a pessoa só disse que saiu, sem recusar: a Lia pode pedir uma indicação **uma única vez**. Se a resposta for negativa, agradece e encerra, sem insistir.
3. **Registro no CRM:** a conversa fica encerrada como "contato não trabalha mais na empresa", sem descadastrar o número como pedido de parar e sem criar novas retomadas.
4. **Orientação no prompt** da Lia com a mesma regra, e garantia no servidor: mesmo que a IA gere outro pedido de indicação, a mensagem é trocada pelo agradecimento e encerramento.

## Conversa do Andre
Nada será enviado sem sua ordem. Hoje ela está com "Humano atendendo". Se quiser, depois de publicado, posso enviar um agradecimento curto.

## Validação
- Testes automáticos com as duas mensagens do Andre e variações; continuar sem encerrar em "sou eu quem cuida da área" e em "não é o momento".
- Painel de teste da Lia (simulado), checagem de tipos, de código e compilação, com resultados reais. Nada publicado sem aceite.

## Detalhes técnicos
- `policy.ts`: `isFormerEmployee(text)` e `declinesReferral(text)`; dispensar quando houver "mas ainda trabalho/cuido".
- `worker.server.ts`: na regra de contato errado (só jobs `reply`), tratar `isFormerEmployee`; se o histórico já tem pedido de indicação da Lia ou há recusa, forçar encerramento cordial; motivo `left_company`.
- `agent.server.ts`: regra no prompt.
- Sem migration.
