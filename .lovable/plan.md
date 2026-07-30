# Corrigir modal "Incluir todos em uma fila" (contagem e filas existentes)

## O que foi verificado

- A busca usada tem **35 resultados** e gerou **35 leads distintos** (`prospecting_results`: 35 linhas, 35 `imported_lead_id` únicos). Ou seja, não houve duplicação real de leads no banco.
- A fila criada pelo fluxo (`Fila teste 001`, manual, entity `lead`) ficou com **35 itens** — coerente.
- A fila que já existia antes (`teste`) é do tipo **dinâmica**, não manual. O modal só lista filas com `kind = manual`, por isso apareceu "Nenhuma fila manual" mesmo existindo uma fila.
- A lista de ids enviada ao modal não é deduplicada: se dois prospects apontarem para o mesmo lead (mesmo e-mail), o título contaria o mesmo lead duas vezes.

Conclusão: a "fila existente" não aparecer é comportamento do filtro (só filas manuais), não um erro de dados. A contagem "dobrada" não se confirma nos dados atuais; o título simplesmente conta todos os prospects processados (importados + já existentes), sem deduplicar.

## O que será feito

1. **Contagem correta no modal**
   - Deduplicar os ids de leads antes de abrir o modal.
   - Título passa a mostrar a quantidade de leads únicos e, quando houver, uma linha auxiliar "X já haviam sido importados".

2. **Filas existentes visíveis**
   - O seletor passa a listar todas as filas de leads: as manuais selecionáveis e as dinâmicas exibidas como desabilitadas, com o motivo ("fila dinâmica — não aceita itens manuais").
   - Quando não houver nenhuma fila manual, mensagem explicativa acima do campo de criar nova fila.
   - Recarregar a lista de filas sempre que o modal abrir (evita cache antigo logo após criar uma fila).

3. **Feedback pós-inclusão**
   - Toast informa o nome da fila e o total de itens nela após a adição.

## Detalhes técnicos

- `src/routes/_authenticated/settings.prospecting.tsx`: `importMany` retorna `ids` deduplicados (`Array.from(new Set(ids))`) e também `alreadyIds`; `addToQueueFlow` repassa a contagem de já existentes ao modal.
- `src/components/prospecting/add-to-prospecting-dialog.tsx`: nova prop opcional `alreadyCount`; separação de `manualQueues` e `dynamicQueues`; `SelectItem` desabilitado para dinâmicas; `refetchOnMount: "always"` na query de filas; mensagem de vazio.
- Sem migration, sem alteração de RLS, server functions ou regras de negócio.

## Como validar

1. Abrir `/prospecting?tab=prospecting`, entrar em uma busca e clicar em "Incluir todos em uma fila".
2. Conferir que o título mostra a mesma quantidade de leads únicos dos resultados.
3. Conferir que a fila manual `Fila teste 001` aparece selecionável e a fila dinâmica `teste` aparece desabilitada com o motivo.
4. Adicionar à fila existente e verificar o toast com nome da fila e total.
