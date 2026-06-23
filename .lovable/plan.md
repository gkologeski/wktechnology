## Objetivo

Padronizar o card de "Negócios" associados (em Contatos e Empresas) com o mesmo nível de detalhe dos cards de Contato/Empresa, conforme print de referência:

```
[💼] Nome do negócio (link)
VALOR              R$ 216.000,00
DATA DE FECHAMENTO 24 de Abril de 2025
ETAPA DO NEGÓCIO   Negócio fechado ▾
Adicionar rótulo
                                  → Exibir todos os Negócios associados
```

## Mudanças (apenas `src/components/record/associations-panel.tsx`, função `DealsCard`)

**1. Query**
- Adicionar `expected_close_date` ao `select` das três fontes (primary, company, linked) — já há `id, name, value, stage, currency`.

**2. Layout de cada item**
- Substituir o cartão compacto atual (nome + valor + badge de etapa em linha) por:
  - Header: `EntityAvatar` com ícone `Briefcase` (tone primary) + `<Link to="/deals/$id" params={{id:d.id}}>` com nome em `text-sm font-semibold text-primary hover:underline truncate` + `AssocItemActions` (olho + …) à direita, no padrão `group`/`opacity-0 group-hover:opacity-100` já existente.
  - `DetailRow` reaproveitado:
    - "Valor" → `formatCurrency(d.value, d.currency)`
    - "Data de fechamento" → `expected_close_date` formatado em pt-BR (ex.: `24 de Abril de 2025`) via `Intl.DateTimeFormat('pt-BR', { day:'numeric', month:'long', year:'numeric' })`; oculta linha se nulo (o `DetailRow` já trata).
    - "Etapa do negócio" → valor renderizado como **botão inline com chevron** que abre um `DropdownMenu` listando os estágios do pipeline do negócio; ao clicar, executa `update deals set stage=? where id=?` e atualiza o item localmente (sem refetch global).
  - `AssocLabelAdder` no rodapé do item.
- Wrapper do `<li>`: `rounded-xl border border-border/60 p-3 group hover:border-border transition-colors` (mesmo padrão dos demais).

**3. Etapas (stage picker)**
- Reusar `usePipelines()` (já importado no projeto em `deals.$id.tsx`) para obter os estágios. Como o card pode listar negócios de pipelines diferentes, buscar `pipeline_id` no select; resolver os estágios via `pipelines.find(p => p.id === d.pipeline_id)`. Se não houver pipeline, exibir o `d.stage` cru sem dropdown.
- Componente local `StagePicker({ deal, onChange })` encapsula o `DropdownMenu` com itens.
- Toast de sucesso "Etapa atualizada" / erro.

**4. Footer**
- Trocar o atual final do card (sem rodapé) por `<ViewAllFooter href="/deals" label="Exibir todos os Negócios associados" />` quando houver pelo menos 1 negócio.

**5. Remover**
- O botão `X` lateral atual (unlink direto) — desvincular passa a estar apenas no menu `…` (consistente com Contatos/Empresas).

## Fora do escopo

- Demais cards (Tasks, Emails, Attachments, Tickets, SingleDealCard) — intocados.
- Alteração de estágio em lote, drag-and-drop ou edição de outros campos do negócio inline.

## Validação

Abrir `/companies/<id>` e `/contacts/<id>` e confirmar para cada negócio listado:
- Avatar + nome linkável aparecem; ações `…/olho` aparecem só no hover.
- "Valor", "Data de fechamento" e "Etapa do negócio" aparecem com tipografia idêntica ao card de Contato.
- Clicar na etapa abre dropdown com os estágios do pipeline e altera no banco.
- Rodapé "Exibir todos os Negócios associados" navega para `/deals`.
