# Plano: indicador visual de snippets no QuoteWizard

## Objetivo
Na etapa 3 (Observações & Termos) do wizard de cotação, adicionar uma dica sutil abaixo de cada `RichHtmlEditor` indicando que o usuário pode digitar `/` para inserir snippets, igual já funciona em e-mails, notas e WhatsApp.

## Escopo
- Apenas `src/components/deals/quote-wizard.tsx`, etapa `step === 2`.
- Nenhuma mudança em `RichHtmlEditor`, lógica de snippets, banco, RLS ou server functions.

## Implementação

### 1. Indicador abaixo dos editores
- Inserir um elemento de hint logo após cada `<RichHtmlEditor>` na etapa 3.
- Conteúdo: ícone `Slash` (Lucide) + texto "Digite `/` para inserir um snippet".
- Estilo:
  - `text-xs text-text-tertiary`
  - `flex items-center gap-1.5`
  - ícone `h-3 w-3`
  - margem superior `mt-1.5`
- Garantir que use tokens semânticos do design system para dark mode.

### 2. Acessibilidade
- Adicionar `aria-label` ou descrição implícita via texto visível; nenhuma informação importante apenas por cor/ícone.
- Manter `htmlFor`/`id` dos labels existentes intactos.

### 3. Validação
- Verificar visualmente no preview que a dica aparece abaixo de "Observações" e "Termos e condições".
- Confirmar que o popover de snippets ainda abre ao digitar `/` (funcionalidade já existente).
- Validar dark mode e responsividade.

## Fora de escopo
- Criar componente genérico de hint (a menos que já exista um padrão no projeto; nesse caso, usá-lo).
- Alterar comportamento do snippet picker ou adicionar novos gatilhos.
- Persistir estado de "dismiss" da dica.
