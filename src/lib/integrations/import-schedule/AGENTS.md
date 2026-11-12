# Importação contínua (Clockify, Jibble, ClickUp)

- Agenda por workspace+provedor em `import_connector_schedules` (RLS: admin ativo; dono = quem salvou); próximo horário só por `schedule.ts`; por quê: mesma regra na tela, no agendador e nos testes.
- O agendador (`clockify-import-tick`) só inicia prévia/importação pelas funções oficiais de cada importador, reconfere `work_import_delegate_allowed` do dono e desliga a agenda se a permissão cair; por quê: automação nunca contorna prévia, idempotência nem permissão.
- ClickUp automático só via RPC `clickup_import_delegate` (service_role, lista fixa de etapas, em nome do dono, que segue reconferido); listas nunca importadas ficam "não importar" até revisão; por quê: sem sessão no agendador e sem criar organização nova sem humano.
