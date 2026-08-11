# Botão de duplicar em Presets de Contratação

## Contexto

A tela `/catalog/contracting-presets` lista presets de contratação e já oferece ações de editar, ativar/desativar e excluir. Não há uma forma rápida de criar um novo preset a partir de um existente.

## O que será feito

1. **Server function `duplicateContractingPreset`** em `src/lib/contracting-presets.functions.ts`.
   - Recebe `{ id: string }` do preset fonte.
   - Valida permissões `VIEW` (ler o fonte) e `CREATE` (criar cópia) do recurso `techsales.catalog.services`.
   - Lê o preset fonte com o mesmo `SELECT` já usado nas outras operações.
   - Insere uma cópia com:
     - `name`: nome original + `" (cópia)"`;
     - `code`: se existir, `"<code>-copia"`;
     - `active: true`;
     - demais campos idênticos ao fonte;
     - `owner_id` e `workspace_id` do usuário corrente.
   - Retorna o novo registro.

2. **Botão "Duplicar" na lista** em `src/routes/_authenticated/catalog.contracting-presets.tsx`.
   - Importar `Copy` do `lucide-react` e a nova server function.
   - Adicionar `useServerFn(duplicateContractingPreset)`.
   - Adicionar handler `duplicate(r: Preset)` que chama a server function, exibe toast de sucesso/erro e invalida as queries `contracting_presets` e `contracting-preset-options`.
   - Inserir botão ícone-only `variant="ghost" size="icon"` entre editar e excluir, com `aria-label="Duplicar ${r.name}"`.
   - Seguir o padrão já usado em outras telas (ex.: snippets e modelos de cotação).

## Fora de escopo

- Não altera schema, RLS, policies, permissões atribuídas ou regras de negócio.
- Não muda o layout geral da tela nem o modal de criação/edição.
- Não adiciona confirmação: duplicar é uma ação não-destrutiva.

## Como validar

1. Abrir `/catalog/contracting-presets`.
2. Clicar no botão de duplicar de um preset existente.
3. Verificar que um novo preset aparece com o mesmo nome + `" (cópia)"` e com os mesmos valores (cargo, senioridade, stack, preço, custo, moeda, unidade, linha de serviço, descrição, observação).
4. Verificar que o toast "Preset duplicado." é exibido.
5. Rodar typecheck/build para garantir que não há regressão.
