# Corrigir resposta incoerente da Lia com "Contato compartilhado"

Porte P — cerca de 20 a 30 minutos.

## O que aconteceu
Maikew enviou o cartão "Daniel Flamia: +55 49 98828-5805". A Lia aplicou ao mesmo tempo duas regras:
- "Indicação completa" (nome + telefone) → "Anotei que o Daniel Flamia é o responsável";
- "Telefone solto" (só número) → "Com quem devo falar neste número?".

A regra do telefone solto não diz que um cartão que já traz nome não conta como "só telefone".

## O que vou mudar
1. Regra "Telefone solto": vale só quando não houver nome nenhum (nem escrito, nem no cartão). Cartão com nome nunca é telefone solto.
2. Regra "Indicação completa": passa a ter prioridade explícita; quando ela vale, a resposta não pode terminar com pergunta sobre a pessoa indicada (nome, quem atende no número, etc.).
3. Exemplo de resposta correta na regra: "Obrigada, Maikew! Vou falar com o Daniel Flamia."

## Testes
- Teste da instrução: garantir que o texto de prioridade existe.
- Teste com a IA real (sem enviar mensagem ao cliente) usando a conversa do Maikew, conferindo que a resposta não pergunta com quem falar.
- Rodar os testes do SDR.

## Fora do escopo
- Não reenviar nada ao Maikew nem corrigir a mensagem já enviada.
- Nada publicado sem seu aceite.

## Detalhe técnico
Ajuste apenas nas linhas do CONTRATO TÉCNICO em `src/lib/prospecting/sdr/agent.server.ts`; persona publicada não muda.
