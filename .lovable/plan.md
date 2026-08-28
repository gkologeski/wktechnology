# Salvamento no fim da edição, rótulos no histórico e novo lugar do menu de Configurações

## 1. Parar de salvar a cada digitação

O que o anexo mostra (7 alterações de "Valor": 0 → 0,02 → 0,2 → 2 → 20 → 200 → 2000 → 20000) é
exatamente uma digitação de "20000" em campo com máscara de moeda. Verificado no código: em
`src/components/deals/deal-line-items.tsx` os campos de moeda chamam
`update(li.id, { unit_price: ... })` / `{ discount_amount: ... }` direto no `onValueChange`, ou seja
uma gravação por tecla. Cada gravação do item recalcula o valor do negócio (trigger
`deal_line_items_sync_deal_value`), que por sua vez gera um registro em `property_history`.

Correção:

- Campos de moeda/número dos itens de linha passam a confirmar apenas em `blur` ou `Enter`
  (mesmo padrão já usado no campo de desconto em %, que usa `onBlur`).
- Uma única gravação por campo editado, com o valor final.
- Varredura dos demais `CurrencyInput` que gravam em `onValueChange` para aplicar o mesmo padrão
  (auditoria dos arquivos listados na seção técnica; onde a gravação já é por botão/`blur`, nada muda).

Sem mudança de schema, de trigger ou de regra de negócio.

## 2. Sempre exibir rótulos, nunca IDs/hashes

Consultei o histórico real: para o mesmo movimento existem dois registros (`stage` e `stage_id`) com
valores crus (`proposal`, `negotiation`), além de valores legados do HubSpot (`72362548`,
`1018009921`) e `stage_substatus_id` em UUID.

Correção na camada de exibição (timeline e gaveta de histórico):

- Resolver etapa pelo catálogo de etapas do pipeline do registro: mostra o rótulo cadastrado
  ("Proposta", "Negociação") em vez do slug.
- Resolver `stage_substatus_id` (UUID) e `pipeline_id` pelos nomes cadastrados.
- IDs legados sem correspondência viram um rótulo neutro ("Etapa anterior (importada)") em vez do número.
- Deduplicar `stage` + `stage_id` no mesmo grupo: uma linha "Etapa: A → B" por movimento.
- Valores em objeto/JSON passam a ser formatados de forma legível (fim do `[object Object]`).

Nenhum dado histórico é alterado — só a forma de exibir.

## 3. Novo posicionamento do menu de Configurações

Hoje `/settings` renderiza uma coluna fixa de 280px com a lista completa de configurações ao lado do
menu principal do app — daí a sensação de dois menus.

Proposta recomendada: transformar a navegação de Configurações em **cabeçalho de contexto**:

```text
┌ menu principal ┬──────────────────────────────────────────────┐
│                │  Configurações                    [buscar]   │
│                │  Geral · Equipe · Vendas · Financeiro · ...   │  <- grupos (tabs)
│                │  ─────────────────────────────────────────    │
│                │  [Perfil] [Notificações] [Idioma] ...         │  <- itens do grupo
│                │                                              │
│                │  conteúdo da configuração                     │
└────────────────┴──────────────────────────────────────────────┘
```

- Um `PageHeader` "Configurações" com busca e uma faixa de grupos (abas roláveis).
- Os itens do grupo ativo aparecem como chips/pills logo abaixo, não como segunda coluna.
- Em telas menores tudo colapsa para um seletor único (já existe um `Select` mobile na tela).
- A tela de conteúdo ganha a largura inteira e deixa de parecer um segundo app.

Alternativa, caso prefira manter lista lateral: reduzir para um índice recolhível (ícones) que abre
ao passar o mouse — resolve menos o problema relatado, por isso não é a recomendação.

## Detalhes técnicos

Arquivos previstos:

- `src/components/deals/deal-line-items.tsx` — commit em `blur`/`Enter` nos campos de moeda e quantidade.
- Auditoria de `CurrencyInput` com gravação imediata: `src/routes/_authenticated/contracts.$id.tsx`,
  `invoices.tsx`, `services.$id.tsx`, `proposals.$id.tsx`, `catalog.*` (ajustar só onde grava por tecla).
- `src/lib/timeline/property-labels.ts` — formatação de valores (objetos/JSON) e rótulos neutros para IDs legados.
- `src/lib/timeline/history-groups.ts` — dedupe de `stage`/`stage_id` no grupo.
- `src/components/activity/use-history-labels.ts` — resolver etapa/substatus/pipeline pelo catálogo.
- `src/components/property-history-drawer.tsx` — reutilizar a mesma formatação.
- `src/routes/_authenticated/settings.tsx` — novo cabeçalho de contexto com grupos + chips.

Fora de escopo: alterar triggers de histórico, schema, RLS ou o conteúdo já gravado.

## Como validar

1. Em um negócio, editar preço de item de linha digitando o valor: deve gerar **uma** entrada de
   histórico com o valor final.
2. Na timeline, mover a etapa: deve aparecer uma linha "Etapa: Proposta → Negociação" com rótulos.
3. Abrir registros antigos importados: nenhum número/UUID cru na timeline nem na gaveta.
4. Em `/settings`, navegar pelos grupos: sem coluna lateral concorrendo com o menu principal.
