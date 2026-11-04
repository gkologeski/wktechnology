# Corrigir agradecimento e nome em contato compartilhado

Porte P, estimativa de 40 a 60 minutos.

## Problema
Quando o cliente (Marcelo) compartilha o cartão "Thiago City Gerente TI", a IA:
1. agradeceu chamando o Marcelo pelo nome do indicado ("Obrigada, Thiago City!");
2. usou "City" como sobrenome, quando é o nome da empresa (City Connect BR), e "Gerente TI" é cargo.

## O que será feito
1. **Prompt da Lia e da Bruna** (nova versão publicada de cada uma): regra explícita
   - o agradecimento é sempre para quem enviou a mensagem, pelo nome dele (ou sem nome), nunca pelo nome do indicado;
   - o nome do cartão deve ser limpo: retirar palavras que vêm do nome da empresa e cargos ("Gerente", "TI", "Diretor" etc.), usando só o primeiro nome real. Ex.: "Obrigada, Marcelo! Vou falar com o Thiago."
2. **Auditoria antes do envio** (a mesma que já refaz mensagens): reprovar e refazer a resposta quando o nome usado no agradecimento for o da pessoa indicada e não o do interlocutor.
3. **Nome gravado do indicado**: ao registrar a indicação, o sistema remove do nome as partes iguais ao nome da empresa e termos de cargo, guardando o cargo à parte quando houver.
4. **Corrigir o caso atual**: renomear o cadastro "Thyago City" para o nome limpo (confirmar abaixo) e registrar "Gerente de TI" como cargo, sem mexer no resto.

## Pergunta em aberto
O cartão diz "Thiago" e o cadastro está "Thyago". Vou usar "Thiago", como escrito pelo Marcelo, a menos que você indique outro.

## Testes
- Testes automáticos: cartão "Thiago City Gerente TI" com empresa "City Connect BR" resulta em nome "Thiago" e cargo "Gerente de TI"; agradecimento com o nome do indicado é reprovado pela auditoria.
- Simulador da Lia com a conversa do Marcelo deve responder "Obrigada, Marcelo! Vou falar com o Thiago."

## Detalhes técnicos
- Prompt: `src/lib/prospecting/sdr/agent.server.ts` (regras de indicação, linhas ~115-118) e novas versões publicadas dos agentes.
- Auditoria determinística: módulo de auditoria pré-envio do SDR (`turn.ts`), comparando saudação inicial com `referral_name`/nome do cartão.
- Limpeza do nome: helper puro novo usado no registro da indicação (`referral-complete`), com teste.
- Sem mudança de permissões, banco estrutural ou outras telas.
