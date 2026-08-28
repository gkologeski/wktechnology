# Plano: Corrigir layout do editor de pipeline + finalizar descobribilidade de substatus

## Diagnóstico (confirmado com screenshots)

No editor de etapas em `src/routes/_authenticated/settings.pipelines.tsx` (grid `sm:grid-cols-12` por etapa):
- **Nome** (col-span-3) trunca valores ("(RO) Realizando O…").
- **Prob. %**, **SLA (h)** e **Cor** (col-span-1 cada) ficam estreitos demais — valores escondidos/cortados ("va" no lugar de `var(--…)`).
- A linha da etapa mistura 6 campos + 3 botões de ação em uma única faixa, causando o aperto.
- O editor abre como card inline ao fim da lista, sem rolar até ele.

## O que será implementado

### 1. Reorganizar a linha da etapa em duas linhas (settings.pipelines.tsx)
- **Linha 1:** Nome (flex-1 / col-span maior), Tipo, botões de ação (↑ ↓ 🗑) alinhados à direita.
- **Linha 2:** Identificador, Prob. %, SLA (h) e Cor com larguras mínimas reais (`min-w`) e spans maiores; campo Cor ganha um swatch de preview ao lado.
- Manter labels acessíveis, foco visível e responsividade (mobile empilha tudo).

### 2. Ao abrir o editor, rolar até ele
- `scrollIntoView` no card "Editar pipeline" ao selecionar um pipeline na lista.

### 3. Finalizar descobribilidade de substatus (plano anterior, parcialmente aplicado)
- Já feito nesta sessão: componente `SubstatusManageHint` e uso no `SubstatusSelect` (atalho "Configurar substatus desta etapa" → `/settings/pipelines`, visível só para quem tem permissão de gerenciar pipelines).
- Falta: aplicar o mesmo hint no `SubstatusQuickPicker` (card do Kanban) quando a etapa não tem substatus.
- Bônus no editor: o bloco "Substatus da etapa" já aparece por etapa; manter e garantir que o empty state indique claramente onde clicar ("Adicionar").

### 4. Validação
- `tsgo` para tipos; screenshots via Playwright do editor antes/depois em 1280px e 768px; conferir que nenhum valor fica cortado e que o hint de substatus aparece no Kanban/detalhe quando a etapa está sem substatus.

## Detalhes técnicos

- Arquivos: `src/routes/_authenticated/settings.pipelines.tsx` (layout da linha de etapa + scroll), `src/components/pipelines/substatus-quick-picker.tsx` (hint), `src/components/pipelines/substatus-manage-hint.tsx` e `substatus-select.tsx` (já alterados).
- Apenas JSX/classes utilitárias — sem mudança de schema, RLS ou regra de negócio.
- Tokens semânticos existentes; nada de cores hardcoded.

## Fora de escopo

- Renomear/limpar os identificadores numéricos importados (só exibição; não altera dados).
- Drag-and-drop para reordenar etapas (hoje é por botões ↑ ↓).
