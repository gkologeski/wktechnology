# Ajustes: salvamento no fim da edição, rótulos legíveis e enriquecimento LinkedIn sob demanda

## 1. Campos numéricos de contratos e faturas

O que a auditoria mostrou:

- `contracts.$id.tsx` (Valor total), `invoices.tsx` (Valor), `proposals.$id.tsx`, `services.$id.tsx` e
  `catalog.*` usam `CurrencyInput` ligado a **estado local**, com gravação por botão Salvar — não há
  gravação por tecla nesses lugares.
- O único caso de gravação por tecla era em itens de linha de negócio, já corrigido com
  `CurrencyCommitInput`.
- Nenhum `type="number"` do sistema persiste direto no banco.

O que ainda muda, para eliminar o risco de reincidência e padronizar:

- Trocar `CurrencyInput` por `CurrencyCommitInput` (commit em blur/Enter) nos campos de valor de
  contratos, faturas, propostas e serviços — comportamento visível idêntico, mas o valor confirmado
  só entra no estado do formulário ao sair do campo, evitando efeitos/autosave por tecla se algum
  autosave for adicionado depois.
- Onde houver autosave por efeito dependente do valor, passar a depender do valor confirmado.

Sem mudança de schema, trigger, RLS ou regra de negócio.

## 2. Rótulos sempre legíveis no histórico e nas atividades

Verificado no banco: os IDs numéricos que apareciam na timeline (`72337520`, `72362548`) **existem**
como `value` de etapas de pipelines de negócio (importação HubSpot manteve o id como valor da etapa),
portanto são resolvíveis pelo catálogo. Já os valores `proposal` / `negotiation` vêm do enum
`deal_stage` e não existem em nenhum pipeline — hoje aparecem crus.

Ajustes na camada de exibição:

- Indexar as etapas do catálogo por `value` **e** por `id`, para cobrir formatos diferentes de
  pipeline.
- Adicionar dicionário pt-BR para os valores de enum de etapa/status (`new`, `qualified`,
  `proposal`, `negotiation`, `won`, `lost`, etc.) usado como segundo fallback.
- Terceiro fallback para IDs/UUID sem correspondência: rótulo neutro (`Etapa anterior (importada)` /
  `Registro removido`), nunca o hash.
- Aplicar a mesma cadeia de resolução em todas as superfícies: cards de histórico da timeline,
  gaveta de histórico de propriedades e histórico de substatus.
- Auditar descrições de atividades geradas pelo sistema para não conter UUID/ID cru.

Nenhum dado histórico é alterado — só a forma de exibir.

## 3. Enriquecimento LinkedIn apenas quando o link muda

Situação atual: `leads.$id.tsx` já compara o LinkedIn antes/depois de salvar antes de reenriquecer,
mas a comparação depende de uma âncora em `useRef` semeada uma vez por lead, e o painel de
qualificação tem seu próprio disparo (`useQuery` com `force`), o que permite disparo duplicado e mais
de um toast para a mesma ação.

Ajustes:

- Centralizar a decisão em um hook único de enriquecimento por LinkedIn: recebe a URL normalizada,
  compara com a última URL efetivamente enriquecida para aquele lead, ignora chamadas iguais e
  serializa chamadas concorrentes (uma execução em voo por lead).
- Reenriquecer só quando a URL normalizada mudar de valor válido; salvar outros campos nunca dispara.
- Feedback único: um único toast com `id` estável por lead, atualizado de "reenriquecendo" para
  sucesso/aviso/erro — sem toasts empilhados entre a tela do lead e o painel de qualificação.
- Sem `force` implícito: o disparo forçado continua existindo apenas no botão manual do painel.

## Detalhes técnicos

- `src/components/ui/currency-commit-input.tsx` — reutilizado (já existe).
- `src/routes/_authenticated/contracts.$id.tsx`, `invoices.tsx`, `proposals.$id.tsx`,
  `services.$id.tsx` — troca de `CurrencyInput` por `CurrencyCommitInput` nos campos de valor.
- `src/lib/timeline/property-labels.ts` — dicionário de etapas/status de enum e rótulos neutros.
- `src/components/activity/use-history-labels.ts` — indexar etapas por `value` e `id`; cadeia de
  fallback.
- `src/components/property-history-drawer.tsx`, `src/components/activity/history-timeline-item.tsx`,
  `src/lib/pipelines/substatus-history.ts` — mesma resolução de rótulos.
- Novo `src/lib/prospecting/use-linkedin-enrichment.ts` — hook de disparo/dedupe/toast único,
  consumido por `src/routes/_authenticated/leads.$id.tsx` e
  `src/components/prospecting/qualification-panel.tsx`.

Fora de escopo: schema, triggers, RLS, conteúdo já gravado em `property_history` e a lógica
server-side da cascata Apollo.

## Como validar

1. Editar o valor total de um contrato e o valor de uma fatura digitando: uma única gravação, uma
   entrada de histórico com o valor final.
2. Abrir a timeline de um negócio importado: nenhuma etapa como número/UUID; `proposal → negotiation`
   aparece como "Proposta → Negociação".
3. Salvar qualquer campo do lead sem tocar no LinkedIn: nenhum enriquecimento disparado.
4. Alterar o LinkedIn do lead: um único enriquecimento e um único toast de feedback.
