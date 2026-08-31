# Alterar substatus direto no card do negócio

## O que acontece hoje (verificado)

- No card do Kanban, o `SubstatusQuickPicker` só abre o seletor quando a etapa tem substatus cadastrados. Quando não tem, ele troca o seletor pelo link "Configurar substatus desta etapa" (visível apenas para quem gerencia pipelines).
- Os substatus cadastrados hoje cobrem só parte das etapas: em Novos Negócios existem substatus em `scope/solution`, `proposal`, `negotiation` e `contract`; nas demais etapas (ex.: negócio fechado/perdido) não há nenhum. Por isso, nesses cards aparece só o atalho de configuração.

## O que muda

O card passa a ser sempre um ponto de alteração de substatus, nunca apenas um atalho de configuração:

- O gatilho no card sempre existe: badge do substatus atual ou "definir substatus" quando vazio.
- Ao clicar, abre o popover com:
  - a lista de substatus ativos da etapa (quando houver), com o atual marcado;
  - a opção "Sem substatus" para limpar;
  - estado vazio "Nenhum substatus nesta etapa" quando a etapa não tem cadastro, e — apenas para quem pode gerenciar pipelines — o link "Configurar substatus desta etapa" dentro do popover (deixa de ocupar o card).
- Sem permissão de atualizar o registro: continua exibindo apenas o badge (somente leitura).
- Mesmo comportamento em Leads e Negócios, já que ambos usam o mesmo componente.

Mantido: loading, erro por toast, `deleteRowGuarded`/RLS, histórico de substatus, invalidação de cache e a regra de que trocar de etapa reavalia o substatus. Sem mudança de schema, RLS, permissões ou regra de negócio.

## Detalhes técnicos

- `src/components/pipelines/substatus-quick-picker.tsx`: remover o early return que troca o picker pelo `SubstatusManageHint`; renderizar sempre o `Popover` e mover o hint + mensagem de vazio para dentro do `PopoverContent`.
- `src/components/pipelines/substatus-manage-hint.tsx`: sem mudança de comportamento (segue oculto sem `PIPELINES_MANAGE`); usado agora dentro do popover.
- `SubstatusSelect` (telas de detalhe de lead/negócio) permanece como está — o pedido é sobre o card.
- Validação: `bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e verificação manual no quadro de Negócios (etapa com e sem substatus, light/dark, 768/1280).
