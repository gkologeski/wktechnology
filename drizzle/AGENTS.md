# Migrations

- DEFAULT de `workspace_id` só troca para `default_workspace_for_user(auth.uid())` depois que todo gravador fora do navegador da tabela envia o tenant da origem; por quê: job sem tenant deve falhar, nunca cair no tenant original.
