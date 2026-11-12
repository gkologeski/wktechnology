# Importação contínua (Clockify, Jibble, ClickUp)

- Agenda por workspace+provedor em `import_connector_schedules` (RLS: admin ativo; dono = quem salvou); próximo horário só por `schedule.ts`; por quê: mesma regra na tela, no agendador e nos testes.
- O agendador (`clockify-import-tick`) só inicia prévia/importação pelas funções oficiais de cada importador, reconfere `work_import_delegate_allowed` do dono e desliga a agenda se a permissão cair; por quê: automação nunca contorna prévia, idempotência nem permissão.
- ClickUp fica sem execução automática enquanto suas RPCs exigirem sessão de usuário; por quê: não simular automação inexistente.
