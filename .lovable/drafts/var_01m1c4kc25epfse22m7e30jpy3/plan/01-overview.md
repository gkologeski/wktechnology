# Criador vs Responsável (padrão HubSpot) em todo o sistema

## O que existe hoje (verificado no banco e no código)

Sua suspeita está certa, e o quadro é ainda mais confuso do que dois campos:

- **3 colunas** convivem nas entidades centrais de CRM: `owner_id`, `assigned_to` e `assigned_user_id` (leads, contatos, empresas, negócios têm as três, mais `hubspot_owner_id`).
- 57 tabelas têm `owner_id` **e** `assigned_to`; **165 tabelas têm só `owner_id`**; 8 têm só `assigned_to`; apenas 34 têm `created_by`.
- Os dados já divergem: **153 leads** têm `assigned_user_id` diferente de `assigned_to`; 55 leads, 39 contatos, 36 empresas e 63 atividades estão sem `assigned_to`.
- No código, `owner_id` aparece em 325 arquivos e `assigned_to` em 60 — várias telas chamam `owner_id` de "Responsável" (é o caso do quadro de Negócios: o filtro e o card leem `owner_id`, enquanto a edição em massa grava em `assigned_to`).
- **536 políticas RLS** usam `owner_id`. Ele é hoje, de fato, a coluna de escopo de acesso — não pode ser renomeada nem repropositada de forma abrupta.

## Semântica-alvo (igual HubSpot)

| Conceito HubSpot | Coluna no TechERP | Editável? |
| --- | --- | --- |
| Criado por (Created by) | `owner_id` (mantida) + `created_by` onde existir | não (imutável após criação) |
| Proprietário / Responsável (Owner) | `assigned_to` | sim, em detalhe, grid e edição em massa |
| Proprietário do HubSpot | `hubspot_owner_id` (só espelho de integração) | não |
| — | `assigned_user_id` | descontinuada, virando espelho de `assigned_to` |

Regra única de leitura em todo o sistema: **Responsável = `assigned_to`, com fallback para `owner_id`** enquanto houver registro sem responsável. **Criador = `created_by ?? owner_id`**.
