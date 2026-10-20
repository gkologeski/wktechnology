# Importador Clockify

- leitura só GET em hosts oficiais (POST apenas em relatório), staging privado, gravação no ERP só via RPC `clockify_import_apply` a partir de prévia confirmada, segundos/UTC no vínculo idempotente e nunca sobrescreve edição do ERP; guia em `docs/architecture/clockify-import.md`; por quê: histórico completo sem alterar a origem, sem duplicar e sem disparar workflows.
