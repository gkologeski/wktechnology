# Ajustar quebra de linha e centralização na matriz de permissões

## Diagnóstico confirmado

Em `src/components/access-control/permissions-matrix.tsx`, a célula "Recurso / Ação" renderiza o rótulo da permissão com `truncate`:

```tsx
<span className="text-foreground truncate">{p.label_pt}</span>
```

Isso força o texto em uma única linha e corta frases longas. A linha da tabela não tem altura mínima, então o conteúdo fica compacto. As demais células (checkboxes) estão com `text-center`, mas sem garantia explícita de alinhamento vertical quando a linha crescer.

## O que será feito

1. **Permitir quebra de linha do rótulo** na célula de recurso/ação:
   - Remover `truncate`.
   - Adicionar `whitespace-normal` e `break-words` (ou `leading-snug`) para que o texto ocupe várias linhas quando necessário.

2. **Aumentar a altura da linha**:
   - Aumentar o padding vertical das células de permissão (`py-3` ou similar) para dar respiro visual e manhar o texto legível.
   - Garantir que as células dos badges (ação/escopo) e o rótulo fiquem alinhados verticalmente ao centro.

3. **Centralizar os demais campos da tabela**:
   - Manter/confirmar `text-center` nas colunas de cargo.
   - Garantir alinhamento vertical central (`align-middle`) nas células de checkbox, inclusive nas linhas de grupo de recurso.

## Detalhes técnicos

- Arquivo: `src/components/access-control/permissions-matrix.tsx`.
- Alterações puramente de apresentação; sem impacto em RLS, schema, server functions ou regras de negócio.
- Manter tokens semânticos do Tailwind v4 (`text-foreground`, `bg-muted`, `border-b`, etc.).

## Validação

- `tsgo --noEmit` (ou equivalente disponível).
- Verificar visualmente em `/settings/permissions` que frases longas de recurso/ação quebram em múltiplas linhas e que as colunas de cargos permanecem centralizadas.
