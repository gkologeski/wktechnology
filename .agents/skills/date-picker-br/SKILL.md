---
name: date-picker-br
description: Seletor de data única (não intervalo) em pt-BR, com atalhos Ontem, Hoje, Amanhã e Personalizado. Use sempre que uma tela precisar de um campo de data simples — vencimento, admissão, data da atividade, filtro por dia — em vez de <input type="date">.
---

# Date Picker (pt-BR) — data única

Componente reutilizável de **data única**. Retorna uma `Date` (e a chave do preset escolhido) e permite escolher qualquer dia no calendário. Para intervalos, use a skill `date-range-picker-br`.

## Quando usar

- Campo de data em formulário (vencimento, admissão, início, entrega).
- Filtro por um único dia.
- Substituição de `<input type="date">` para manter o padrão visual e o locale pt-BR.

## Dependências

```bash
bun add date-fns
```

Componentes shadcn necessários (já presentes no template): `button`, `calendar`, `popover`, `separator`.

## Presets (canônicos, não renomear)

O **primeiro** item da lista é sempre `Personalizado`. Ele não aplica data: só coloca o seletor em modo livre para o usuário escolher no calendário.

| Key | Rótulo | Data |
|---|---|---|
| `custom` | Personalizado | nenhuma (habilita o calendário) |
| `yesterday` | Ontem | `startOfDay(subDays(now, 1))` |
| `today` | Hoje | `startOfDay(now)` |
| `tomorrow` | Amanhã | `startOfDay(addDays(now, 1))` |

Ordem na UI, de cima para baixo: **Personalizado**, **Ontem**, **Hoje**, **Amanhã**.

## Regras de comportamento (críticas)

1. `Personalizado` fica no topo, acima de `Ontem`. Clicar nele apenas marca o preset como `custom` e **mantém o popover aberto**.
2. `Ontem`, `Hoje` e `Amanhã` aplicam a data imediatamente e fecham o popover.
3. O calendário é `mode="single"`, com **um mês** (`numberOfMonths={1}`). Um clique já é uma seleção completa: dispara `onChange` e fecha o popover — aqui **não existe** o protocolo de dois cliques da versão de intervalo.
4. Toda data é normalizada para o início do dia (`startOfDay`) para não vazar hora local nas comparações.
5. Sempre inclua `pointer-events-auto` no wrapper do `Calendar`, senão ele fica inerte dentro do popover.
6. Quando `onClear` é informado, exiba a ação "Limpar" e chame-a sem fechar o valor em um dia arbitrário.

## Locale

Sempre pt-BR:

```ts
import { ptBR } from "date-fns/locale";
format(date, "dd/MM/yyyy", { locale: ptBR });
```

Rótulo do botão: a data formatada em `dd/MM/yyyy`, ou o `placeholder` quando não há valor.

## Arquivos de implementação

Copie de `references/`:

1. `src/lib/date-single-presets.ts` — `getSinglePresetDate(key)` e `SINGLE_PRESETS` (rótulo + key). Centraliza o cálculo, fácil de testar.
2. `src/components/date-picker.tsx` — o componente. Props:
   ```ts
   type DatePickerProps = {
     value?: Date;
     onChange: (date: Date, presetKey?: SinglePresetKey) => void;
     onClear?: () => void;
     defaultPreset?: SinglePresetKey; // padrão "today"
     placeholder?: string;
     align?: "start" | "center" | "end";
     size?: "sm" | "default";
     ariaLabel?: string;
     className?: string;
   };
   ```

Para telas que guardam a data como texto `YYYY-MM-DD`, crie/reuse um adaptador fino (`IsoDatePicker`) que converte nas duas pontas, no mesmo espírito de `src/components/iso-date-range-picker.tsx`.

## Acessibilidade e UI

- `aria-label` no gatilho quando não houver `<Label>` visível.
- Foco visível preservado (não remova o ring do `Button`).
- Apenas tokens semânticos de cor — nunca `text-white`, `bg-black` ou `bg-[#...]`.
- Funciona em light e dark mode e em telas estreitas (lista de presets acima do calendário no mobile).

## Arquivos de referência

- `references/date-single-presets.ts` — implementação completa dos presets.
- `references/date-picker.tsx` — componente completo com "Personalizado" no topo.

Leia com `code--view` na hora de implementar.
