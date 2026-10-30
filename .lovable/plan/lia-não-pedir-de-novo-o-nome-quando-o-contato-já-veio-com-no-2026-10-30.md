# Lia: não pedir de novo o nome quando o contato já veio com nome

Porte P · estimativa 15–25 min.

## Problema
Na conversa do Robson, a Lia recebeu primeiro os nomes ("Renner e Júnior") e depois o cartão "Junior Rodrigues: +55 31 97111-9612", e mesmo assim pediu "nome completo" duas vezes. A regra atual só cobre telefone solto sem nome; não há instrução dizendo que nome + telefone (por texto ou cartão) já é indicação completa.

## O que muda (só nas instruções da IA, como combinado antes)
Nova regra no contrato técnico da Lia:
- Se o cliente já informou nome e telefone da pessoa indicada (escrito, ou no cartão "Contato compartilhado", inclusive somando mensagens anteriores, ex.: nomes numa mensagem e cartão na seguinte), a indicação está completa: agradecer, confirmar o nome recebido e encerrar o assunto da indicação. Nunca pedir "nome completo" nem o que já foi dado.
- Se o cliente citou só nomes (ex.: "Renner e Júnior"), pedir apenas o contato (telefone/WhatsApp), sem pedir nome de novo.
- Nome no cartão vale como nome; sobrenome faltante não justifica nova pergunta.

## Testes
- Teste unitário garantindo que o contrato contém a nova regra (texto-chave).
- Rodar uma chamada real da IA com o histórico do Robson para ver a resposta nova (consome créditos), e rodar os testes da Lia.

## Fora do escopo
- Não reenviar nada ao Robson automaticamente.
- Nada publicado sem seu aceite.

## Técnico
Arquivo: `src/lib/prospecting/sdr/agent.server.ts` (`TECHNICAL_CONTRACT`, ao lado da regra "Telefone solto"). Atualizar hash em `docs/security/permission-contracts.json` se o arquivo estiver contratado.
