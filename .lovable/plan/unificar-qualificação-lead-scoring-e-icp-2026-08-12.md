# Unificar qualificação, Lead Scoring e ICP

Quatro frentes aditivas. Nada é removido: a decisão manual do SDR continua sobrepondo qualquer nota.

## 1. Score da qualificação com máximo visível

Hoje o cabeçalho mostra apenas `score / corte`, o que faz "0 / corte 60" parecer "0 de 60".

- Passa a exibir `score de máximo` e o percentual, mais o corte como legenda: ex. "45 de 85 (53%) — corte 60".
- O máximo é calculado do questionário: por pergunta, maior opção pontuada (`single`), soma de todas as opções (`multi`), 10 para `boolean`, e o teto configurado para `number`/texto pontuado (item 2). Tudo multiplicado pelo peso.
- Barra de progresso fina com estado "atingiu o corte" (usa tokens semânticos, sem cor avulsa).
- Aviso no editor de questionários quando o corte for **inalcançável** (corte maior que o máximo) — é o caso atual do MEDDIC (corte 70 com apenas 2 perguntas pontuadas) e do GPCT.

## 2. Perguntas de texto podem pontuar

Hoje `text`/`textarea` nunca somam pontos, por isso GPCT (3 de 4 em texto) e MEDDIC (4 de 6) travam em score baixo.

- Cada pergunta de texto ganha um campo opcional "Pontos ao responder" (0 = comportamento atual).
- Pontua quando a resposta tem conteúdo real (não vazia, acima de um mínimo de caracteres configurável, padrão 1), multiplicado pelo peso.
- Mesma regra aplicada no cálculo do navegador e no cálculo do servidor, para não divergirem.

## 3. Qualificação alimenta o Lead Scoring

Hoje `prospecting_qualifications.score` e `leads.score` são notas independentes.

- Ao concluir a qualificação (com decisão), o score da qualificação é lançado no Lead Scoring como um evento de pontuação identificável, atualizando `leads.score`.
- Lançamento **idempotente**: reenviar/reeditar a qualificação ajusta o valor em vez de somar de novo.
- Desqualificação lança pontuação negativa configurável (padrão: nenhuma).
- Nas telas de Lead, o score do lead passa a ter detalhamento por origem ("Regras", "Qualificação", "ICP") no popover já existente do score.

## 4. ICP vira pontuação

Hoje o ICP existe só como filtros da busca de prospects (Apollo), sem virar nota.

- Nova seção "ICP" dentro da aba de Scoring: critérios de porte, faixa de funcionários, receita anual, setor, país/estado e tecnologias, cada um com peso/pontos e o rótulo em PT-BR (usando o dicionário de tradução já existente do HubSpot).
- O motor de scoring passa a avaliar esses critérios contra o lead e a empresa vinculada, gerando pontos de ICP em cada varredura (o mesmo caminho já usado pelas regras, portanto sem duplicação).
- Selo "Fit ICP" (Alto / Médio / Baixo) derivado do percentual de aderência, exibido no detalhe do lead, no painel de qualificação e no card do Kanban.
- Os critérios de ICP podem ser pré-carregados a partir dos filtros da última busca de prospects, com confirmação — sem sobrescrever nada automaticamente.

## Detalhes técnicos

- UI: `src/components/prospecting/qualification-panel.tsx` (cabeçalho de score, máximo, barra), editor de questionários (campos de pontuação de texto + aviso de corte inalcançável), aba de Scoring (`scoring-page.tsx` + nova seção ICP), popover de score no detalhe do lead.
- Cálculo: extrair a lógica de score para um módulo compartilhado (`src/lib/prospecting/score.ts`) com máximo e total, consumido pelo painel e por `src/lib/prospecting/qualifications.functions.ts` (hoje há duas implementações duplicadas).
- Motor: `src/lib/scoring/engine.server.ts` ganha avaliação de critérios de ICP com carregamento da empresa vinculada; lançamento da qualificação usa a tabela de eventos de score com chave estável para idempotência.
- Banco: colunas opcionais em `prospecting_questions` para pontos de texto e mínimo de caracteres; tabela de critérios de ICP por workspace (com GRANTs e RLS por `owner_id`, no mesmo padrão de `scoring_rules`). Nenhuma alteração em RLS existente, autenticação ou dados atuais.
- Compatibilidade: questionários e regras existentes continuam funcionando sem alteração; textos sem pontos configurados seguem valendo 0.
- Testes: unitários para o cálculo de score/máximo e para a avaliação de ICP; typecheck e lint ao final.

## Como validar manualmente

1. `/prospecting?tab=scoring` → seção ICP: cadastrar critérios e rodar a varredura.
2. Abrir um lead e clicar em "Qualificar": conferir "x de y (z%) — corte n", barra de progresso e selo de Fit ICP.
3. Responder perguntas de texto com pontos configurados e ver o score subir.
4. Concluir a qualificação e conferir no detalhe do lead o score atualizado com detalhamento por origem; reeditar a qualificação e confirmar que não duplica pontos.
