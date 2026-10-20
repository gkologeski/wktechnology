# Importador Clockify

- leitura só GET em hosts oficiais (POST apenas em relatório), staging privado, gravação no ERP só via RPC `clockify_import_apply` a partir de prévia confirmada, segundos/UTC no vínculo idempotente e nunca sobrescreve edição do ERP; guia em `docs/architecture/clockify-import.md`; por quê: histórico completo sem alterar a origem, sem duplicar e sem disparar workflows.
- origem escolhida manualmente por ID (nome igual ao do ERP só destaca) e prévia/importação exigem papel proprietário/admin comprovado pela chave atual em `source_access`; por quê: nunca presumir permissão pelo nome nem importar dados parciais como se fossem completos.
- tags/grupos/clientes no fim da importação via RPC `clockify_import_catalogs` (idempotente): tags em `project_time_tags`, grupos em `project_people_groups` (informativos, nunca `user_groups`), cliente vira empresa só se nenhuma empresa tiver nome igual; por quê: completar o catálogo sem mudar escopo de acesso nem mesclar por nome.
