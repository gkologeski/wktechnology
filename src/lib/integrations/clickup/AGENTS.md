# Importador ClickUp

- Leitura só GET em `api.clickup.com` (sem redirecionamento); staging privado `clickup_import_*`; gravação/desfazer só pelas RPCs `clickup_import_apply_step`/`clickup_import_rollback_step`/`clickup_import_sync_assignees`, que reconferem `clickup_import_require` e suprimem workflows (`app.clockify_import`); por quê: revisão humana antes de gravar, sem automações e sem contornar RLS.
- Organização proposta é pura em `clickup-plan.ts` (nome único igual pode sugerir projeto/espaço existente; todas as origens explicitamente autorizadas são incluídas, sem exclusões por nome); decisões finais ficam em `clickup_import_groups`; por quê: mesma regra na prévia e nos testes, ajustável pela tela.
- Vínculo `clickup_import_links` (workspace + tipo + id do ClickUp) impede duplicar entre execuções; desfazer remove só o que a execução criou e ninguém editou, sem horas ou subtarefa mantida; por quê: reimportar ou desfazer nunca apaga trabalho de pessoas.
- Responsáveis só por vínculo confirmado (`clickup_import_people`: e-mail exato confirma, parte do e-mail só sugere); horas do ClickUp são preservadas como origem própria em conferência, sem somar automaticamente a Clockify/Jibble nem gerar aprovação/faturamento; guia em `docs/architecture/clickup-import.md`.

- A coleta integral usa checkpoint durável e escopo `source_team_ids`; cursor do navegador não é autoridade. Originais, arquivados, comentários, anexos e documentos são preservados antes da normalização. Falhas de acesso/conteúdo são lacunas explícitas, nunca coleções vazias ou cobertura completa.
