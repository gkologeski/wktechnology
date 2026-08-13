# Nota unificada do lead: questionário + ICP (0 a 85)

## Objetivo

Ao qualificar um lead, a nota deixa de vir só das respostas do questionário e passa a ser a soma de dois blocos, sempre em escala 0–85, com o perfil do lead exibido a partir dessa nota.

## Como vai funcionar

### Composição da nota

- **Questionário: 50 pontos.** O score bruto das respostas é normalizado pelo máximo teórico do questionário (já calculado hoje) e convertido para até 50 pontos.
- **ICP: 35 pontos.** A aderência aos critérios de perfil (empresa e lead) é normalizada pelo total possível dos critérios ativos e convertida para até 35 pontos.
- **Total: 0 a 85.** Nota final = pontos do questionário + pontos de ICP, arredondada.
- Se não houver critérios de ICP cadastrados, o bloco vale 0 e a UI avisa que o ICP não está configurado (com link para o assistente), em vez de inflar a nota.
- Perguntas numéricas sem teto continuam fora do máximo; nesse caso o painel mostra a nota como estimativa, como já faz hoje.

### Faixas de perfil

Três faixas fixas sobre a nota de 0–85:

- **Fora do ICP:** 0–39
- **Parcial:** 40–59
- **Dentro do ICP:** 60–85

Selo com essas três faixas (tokens semânticos, sem cor avulsa) aparece no painel de qualificação, no detalhe do lead e no card do Kanban de leads. O popover de score ganha o detalhamento "Questionário X/50 · ICP Y/35 · Total Z/85".

### Assistente guiado de ICP

Novo wizard em Prospecção → Scoring → ICP, em passos:

1. **Porte da empresa** — faixas de funcionários e receita anual.
2. **Setor e segmento** — múltipla escolha com os rótulos em PT-BR já existentes.
3. **Região** — país/estado.
4. **Tecnologias** — lista livre.
5. **Perfil do decisor** — cargo/senioridade do contato do lead.
6. **Revisão** — o assistente sugere os pontos de cada critério (distribuídos conforme a importância marcada em cada passo) e mostra a prévia da nota máxima de ICP; o usuário ajusta e confirma.

Ao confirmar, o assistente grava os critérios na estrutura de ICP já existente (`icp_criteria`), sem apagar nada sem confirmação explícita. Critérios já cadastrados continuam válidos e aparecem pré-carregados no wizard.

### Recalculo

A nota unificada é calculada e persistida **ao salvar a qualificação**. Reeditar a qualificação recalcula e substitui o lançamento (idempotente, como hoje). A varredura periódica de ICP continua existindo para o Lead Scoring geral, mas não altera a nota da qualificação já salva.

## Alterações técnicas

- `src/lib/prospecting/score.ts`: novas funções de normalização (`toScale`) e `computeUnifiedLeadScore({ questionnaireScore, questionnaireMax, icpScore, icpMax })` retornando `{ questionnairePoints, icpPoints, total, band }` — fonte única usada no navegador e no servidor.
- `src/lib/scoring/icp.server.ts`: expor o total possível dos critérios ativos (`icpMax`) junto do score, para permitir a normalização.
- `src/lib/prospecting/qualifications.functions.ts`: ao salvar, buscar o ICP do lead, compor a nota unificada e persistir os três valores (questionário, ICP, total) na qualificação, além de lançar no Lead Scoring como hoje.
- `src/components/prospecting/qualification-panel.tsx`: cabeçalho passa a mostrar os dois blocos, o total /85, a barra de progresso e o selo de faixa; aviso quando o ICP não está configurado.
- Novo `src/components/prospecting/icp-wizard-dialog.tsx` (passos do assistente) consumindo `src/lib/scoring/icp.functions.ts`; botão de abertura na seção ICP da aba de Scoring.
- Novo `src/components/prospecting/icp-band-badge.tsx` para o selo de faixa, reutilizado no detalhe do lead e no card do Kanban.
- Popover de score do lead: exibir a quebra Questionário / ICP / Total a partir de `getScoreBreakdown`.
- Banco (migration única): colunas opcionais em `prospecting_qualifications` para `questionnaire_points`, `icp_points` e `total_score`; nenhuma alteração de RLS, autenticação ou dados existentes.
- Testes unitários da normalização e das faixas; typecheck e lint no fim.

## Como validar

1. Prospecção → Scoring → ICP → abrir o assistente, percorrer os passos e confirmar os critérios.
2. Abrir um lead com empresa vinculada, clicar em Qualificar e conferir "Questionário X/50 · ICP Y/35 · Total Z/85" com barra e selo de faixa.
3. Responder mais perguntas e ver os dois blocos e o total subirem coerentemente.
4. Concluir a qualificação e conferir no detalhe do lead o selo de faixa e o detalhamento no popover de score.
5. Reeditar a qualificação e confirmar que a nota é substituída, não somada.
6. Zerar os critérios de ICP e conferir o aviso de ICP não configurado, com o bloco valendo 0.
