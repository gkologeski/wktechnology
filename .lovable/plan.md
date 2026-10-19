# Lia: correções a partir das conversas de 16–19/10 e bloqueio de clientes/negociações em campanhas

## Etapa 0: diagnóstico das conversas (só leitura, antes de mudar código)
Vou ler o histórico real de cada conversa e responder caso a caso. Ainda não confirmei a causa de nenhum deles:
- **Luiz Feitosa:** por que o material não saiu. Hipóteses: o envio de materiais está desligado na Lia (estava assim desde 13/10), a conversa entrou sem campanha ou o arquivo não foi encontrado.
- **Wagner Shimatai:** se o material foi enviado e por qual canal (WhatsApp, e-mail ou link), com base nos registros de envio.
- **Renan Mantovanini:** o que a Lia fez com o número corporativo que recebeu.
- **Anderson (+55 81 99292-9082):** por que a regra de atendimento automático não reconheceu o robô (frase não coberta ou regra ainda não publicada).
- **Pedro Lanna:** de onde veio o nome "José" (variável do modelo, cadastro do Lead ou invenção da IA).

No relatório, cada caso vai separar o que foi confirmado do que não foi possível confirmar.

## Etapa 1: regras da Lia (no texto de instruções e com garantia no servidor)
1. **Nome do cliente:** a Lia usa só o nome do cadastro ou o nome que o próprio cliente informou. Se o cliente corrigir o nome, a correção vale até o fim da conversa e fica registrada como observação. O servidor troca qualquer outro nome próprio usado como vocativo.
2. **Palavra repetida** ("senioridade e senioridade"): verificação no servidor de palavras ou expressões duplicadas em sequência. Quando encontra, a Lia reescreve a resposta uma vez.
3. **Recusa de reunião:** se o cliente disser que não quer reunião, a Lia não oferece reunião de novo nessa conversa. Se ele recusar a reunião mas continuar pedindo informações ou mostrar interesse real, a conversa passa para uma pessoa da equipe com o resumo do que ele quer.
4. **Decisor já identificado:** se o cliente disser que é responsável pela TI, gestor ou decisor, isso fica salvo na conversa e a Lia não pergunta de novo.
5. **Áudio:** a Lia transcreve o áudio recebido com a IA já usada no sistema e responde ao conteúdo. Ela não pede mais que o cliente escreva. Se a transcrição falhar, ela pede desculpas e só então pede que o cliente escreva.
6. **"Você é uma IA?":** a Lia continua respondendo de forma transparente. Se o cliente não responder depois disso dentro do tempo definido (padrão: 30 min em horário de atendimento), a conversa passa para uma pessoa da equipe e as retomadas automáticas são canceladas. Casos de Renato Dutra e Will.
7. **"Não é o momento":** a Lia agradece e encerra, sem perguntar se pode passar o contato a um especialista. Caso de Rafael Acacio.
8. **Robô de atendimento:** mais sinais de robô, como "assistente virtual", "sou o bot", "atendimento automatizado", "selecione", "digite o número" e respostas iguais repetidas, todos testados com o texto real do Anderson. A conversa é encerrada sem resposta.
9. **Número corporativo informado pelo cliente:** a Lia agradece, guarda o número no Contato ou Lead (no campo WhatsApp, se for celular do Brasil, ou em "telefone comercial"), registra na linha do tempo e continua a conversa no canal atual. Ela não manda mensagem sozinha ao número novo.

## Etapa 2: campanhas de WhatsApp com bloqueio de clientes e de negociações
Duas opções novas no público da campanha, ligadas por padrão em campanhas novas:
- **Não enviar a quem já é cliente:** Contato ou Lead ligado a uma empresa com negócio ganho ou contrato ativo.
- **Não enviar a quem está em negociação aberta:** Contato ou Lead ligado a um negócio aberto, em qualquer etapa que não seja ganho ou perdido.

O servidor confere as duas regras ao montar o público e de novo no envio, como já faz o controle de reenvio recente. Quem for bloqueado aparece no quadro de público com o motivo, e a liberação manual é por pessoa. Caso de Leandro Milione.

## O que não muda
Nenhuma mensagem é enviada, nenhuma conversa é reaberta e nada é publicado sem o seu aceite. Nenhum dado de cliente é alterado na Etapa 0.

## Validação
- Testes automáticos com as mensagens exatas de cada caso (Pedro, Rafael, Anderson, Renato, Will, Renan) e casos de controle que não podem disparar as regras.
- Teste da transcrição de áudio com um arquivo de exemplo.
- Teste das regras de bloqueio de clientes e de negociação: cliente ganho, negócio aberto, negócio perdido (este continua sendo enviado) e liberação manual.
- Playwright nas opções novas da campanha. Checagem de tipos, lint, testes e build, com os resultados reais.

## Detalhes técnicos
- `policy.ts` e `third-party.ts`: `detectDuplicatedWords`, `refusedMeeting`, `isAiIdentityQuestion`, `extractCorporatePhone` e mais padrões em `isAutoResponder`.
- `worker.server.ts`: os marcadores `meeting_refused`, `decision_maker_confirmed`, `name_override` e `ai_question_at` ficam nos metadados do enrollment. A passagem para humano usa a ferramenta de handoff que já existe. O tempo limite depois da pergunta sobre IA é verificado no tick que já roda (a cada 2 min).
- Áudio: em `inbound-media.server.ts`, depois do download, a transcrição usa o Lovable AI Gateway (speech-to-text) e o texto é gravado na mensagem antes da Lia processar. O worker espera a transcrição ficar pronta por até o tempo de aguardo do cliente.
- Campanhas: adicionar `exclude_customers boolean default true` e `exclude_open_deals boolean default true` em `whatsapp_campaigns`, numa migration só de adição. A regra fica em `src/lib/campaigns/` ao lado de `recent-contact.ts` e a liberação reaproveita `override_recent` ou um campo análogo. Entram as regras no `AGENTS.md` do WhatsApp.
