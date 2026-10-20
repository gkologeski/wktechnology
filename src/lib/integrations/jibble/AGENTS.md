# Importador Jibble

- Usa as tabelas multi-provedor `time_import_*` (chave workspace+provider+org+entidade+id externo); o Clockify continua em `clockify_*` até migrar sem interromper importação ativa; por quê: estender sem tocar no job Clockify em andamento.
- Só GET em hosts oficiais (`jibble-urls.ts`), POST apenas no token OAuth; nextLink/statusUrl validados; download de export assíncrono sem Authorization e sem excluir o export; por quê: leitura sem alterar a origem e sem SSRF/vazamento de token.
- Eventos In/Out/pausa são reconstruídos por pessoa (`jibble-reconstruct.ts`); timesheets só conciliam, nunca somam; intervalo aberto fica no staging; por quê: não contar horas em dobro nem inventar saída.
- Gravação no ERP só via `clockify_import_apply` (sem workflows) a partir de prévia conferida; sobreposição com outra fonte vira `time_import_duplicates` para decisão humana; desfazer só pelo `time_import_rollback`, que mantém o que foi editado/usado; por quê: não duplicar, não faturar em dobro e não apagar dado alheio.
- Motor fala só com `JibbleStore` (banco em `jibble-store.server.ts`, memória nos testes); guia em `docs/architecture/jibble-import.md`.
