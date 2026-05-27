# Corrigir texto invisível ao selecionar

## Problema

Em várias telas (kanban de leads, pílulas de stage, badges, títulos coloridos, etc.) o texto fica praticamente invisível quando o usuário o seleciona com o mouse — a cor original do texto é muito próxima do azul padrão de seleção do navegador, como no print do lead "Luis Henrique de Oliveira 2026-01".

Causa: o projeto não define nenhuma regra `::selection` em `src/styles.css`, então a cor do texto selecionado depende do navegador/SO e mantém a cor original do elemento.

## Solução

Adicionar uma regra global de seleção no `src/styles.css` que force, em todo o sistema:

- cor do texto selecionado: preto (`#000`)
- cor de fundo da seleção: um tom claro legível derivado do token `--primary` (com transparência), de forma que funcione tanto no tema claro quanto no escuro.

```css
::selection {
  background-color: color-mix(in oklab, var(--primary) 25%, transparent);
  color: #000;
}
::-moz-selection {
  background-color: color-mix(in oklab, var(--primary) 25%, transparent);
  color: #000;
}
```

Isso resolve o problema em **todas as telas de uma vez**, sem precisar editar componentes individuais, e mantém o design system intacto.

## Fora do escopo

- Mudar a cor "padrão" (não selecionada) de qualquer texto do sistema.
- Alterar componentes específicos (kanban, badges, etc.) — a regra global cobre todos.
- Ajustes no tema escuro além da cor de fundo derivada do token (preto continua legível sobre o fundo claro da seleção).
