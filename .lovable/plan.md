# Padrão visual de modais — Sophisticated Canvas

Aplicar a direção escolhida como padrão de TODOS os modais (Dialog) do sistema, sem alterar campos, ordem ou comportamento. Só linguagem visual.

## 1. Tokens de design (`src/styles.css`)

Adicionar/ajustar tokens semânticos usados pelo novo Dialog:

- `--dialog-surface` — branco puro
- `--dialog-border` — slate-200 a 60% de opacidade
- `--dialog-shadow` — `0 32px 64px -16px rgba(0,0,0,0.12)`
- `--dialog-radius` — `24px`
- `--dialog-footer-bg` — slate-50 a 80%
- `--dialog-divider` — slate-100 a 80%
- `--input-surface` — slate-50
- `--input-surface-focus` — branco
- `--input-border` — slate-200 a 70%
- `--input-radius` — `12px` (xl)
- `--ring-primary-soft` — verde primário a 10% (anel de foco 4px)

Tudo em `oklch` no styles.css, como o resto do sistema. Sem cor hardcoded em componentes.

## 2. Componente base — `src/components/ui/dialog.tsx`

Atualizar as primitivas shadcn para refletir o padrão:

- `DialogOverlay`: fundo escuro 20% + `backdrop-blur-md`, fade 180ms.
- `DialogContent`: `max-w-xl` por padrão (variantes `sm`/`md`/`lg`/`xl`), `rounded-[24px]`, sombra premium, borda fina, sem padding interno (deixa pros sub-componentes), entrada com `scale-[0.98] → 1` + fade 180ms.
- `DialogHeader`: `px-8 pt-8 pb-6`, divisor inferior fino, título 20px bold tracking-tight, descrição 14px slate-500 itálico, botão de fechar redondo com hover slate-100.
- Nova `DialogBody`: `p-8 space-y-6 max-h-[70vh] overflow-y-auto` (scrollbar fina).
- `DialogFooter`: `p-6 bg-[--dialog-footer-bg] border-t`, alinhamento à direita, gap-3. Botão secundário (Cancelar) ghost com hover sutil; primário com sombra colorida do verde + `active:scale-[0.98]`.

## 3. Inputs e controles dentro do modal

Atualizar variantes (não criar componentes novos) para que dentro de `DialogBody` os controles assumam o look:

- `Input`, `Textarea`, `Select trigger`: altura 44px (`h-11`), `rounded-xl`, fundo `--input-surface`, borda `--input-border`, no foco trocam para fundo branco + anel 4px verde 10% + borda verde. Transição `transition-all`.
- `Label`: 13px semibold, `ml-1`, slate-700.
- Espaçamento entre grupos: `space-y-6` no body, `space-y-1.5` dentro do grupo.
- Grids de 2 e 3 colunas (`gap-4`) já suportados.
- Combobox/autocomplete (busca de empresa/contato): dropdown com `rounded-xl`, sombra-xl, item ativo com fundo verde 50% e bolinha verde — espelhando o protótipo.

## 4. Botões dos modais

- Primário no footer: `bg-primary` (verde do sistema), `rounded-xl`, fonte bold, sombra colorida `0 4px 12px primary/25`, hover sombra mais larga, `active:scale-[0.98]`.
- Secundário: ghost, `rounded-xl`, hover `bg-slate-200/50`.
- Garantir que ambos respeitam dark mode via tokens.

## 5. Migração dos modais existentes

Como tudo vira no nível de `Dialog`/`Input`/`Button`, os modais herdam automaticamente. Revisar visualmente e ajustar apenas:

- `src/components/leads/create-deal-from-lead-dialog.tsx` (benchmark)
- Modais de criar Lead, Contato, Empresa, Negócio (lista)
- Modal de edição em massa (bulk edit)
- Modais de confirmação (AlertDialog) — aplicar mesma superfície/raio/sombra, mantendo layout compacto
- Modais de pipelines/estágios em settings
- Modais de importação HubSpot

Para cada um: substituir paddings/divisores ad-hoc pelos novos `DialogHeader`/`DialogBody`/`DialogFooter` quando ainda estiverem inline.

## 6. Dark mode

Definir o mesmo conjunto de tokens em `.dark` no styles.css, mantendo o feeling claro/premium (superfície ligeiramente translúcida, footer um tom acima do body, anel de foco do mesmo verde).

## 7. Verificação

Depois de implementar:

1. Abrir `Criar negócio` a partir de um lead e comparar com o protótipo aprovado.
2. Abrir `Criar lead`, `Criar contato`, `Criar empresa` e confirmar consistência.
3. Abrir um `AlertDialog` (ex.: excluir registro) e confirmar que herda o estilo.
4. Conferir no viewport 978px (que é o que o usuário usa) que `max-w-xl` continua confortável e o scroll interno funciona.

## Fora de escopo

- Não muda ordem/quantidade de campos.
- Não vira side-drawer, full-screen ou stepper.
- Não mexe em lógica de submit, validação ou queries.
