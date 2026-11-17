# VAGA-CURRICULO — Orientar candidatos a enviar currículo para rh@wktechnology.com.br

Porte: P · Estimativa: ~30–45 min (código + testes). Publicação fica separada, só se você pedir.

## O que muda para você
Quando alguém, numa ligação da IA de voz ou numa conversa da Lia no WhatsApp, disser que está procurando emprego/vaga em TI (ou quiser trabalhar na WK), a IA:
- agradece o interesse em uma frase;
- orienta a enviar o currículo para **rh@wktechnology.com.br**;
- não tenta vender, não qualifica como lead e não promete vaga nem retorno;
- na ligação, soletra o e-mail com calma ("rh, arroba, wktechnology, ponto com, ponto br") e se despede;
- no WhatsApp, escreve o e-mail por extenso e encerra o assunto educadamente.

Vale para todas as campanhas e roteiros, sem precisar editar cada persona.

## Onde entra
1. Regras fixas da IA de voz (adicionadas a todo roteiro de ligação, campanhas e cadências).
2. Regras fixas do agente de WhatsApp (Lia / SDR), no contrato técnico que vale para todos os agentes.

## Detalhes técnicos
- `src/lib/prospecting/calls/voice-conversation-rules.ts`: constante `CAREERS_EMAIL = "rh@wktechnology.com.br"` e nova seção "Candidatos a emprego (VAGA-CURRICULO)" em `VOICE_CONVERSATION_RULES`.
- `src/lib/prospecting/sdr/agent.server.ts`: nova linha no `TECHNICAL_CONTRACT` usando a mesma constante; `intent=continue` e `situation.conversation=closed` com `close_reason` de candidato, sem handoff nem opt-out.
- Testes: ampliar `voice-conversation-rules.test.ts` e o teste do prompt do SDR para garantir que o e-mail e a regra estão presentes.
- Sem banco, sem permissões, sem telas novas (não exige artigo de Ajuda novo).
- Commit não publicado, separado dos demais pendentes.
