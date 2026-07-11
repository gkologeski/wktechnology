## Diagnóstico

A gravação voltou porque o banco mostra novamente o mesmo arquivo do Drive vinculado a dois eventos diferentes:

- Evento NEXID: `44f7cb9e-9985-4d1d-bf0f-7b3bcfd3ec4f`, Meet `fwd-kvmw-mmj`
- Evento GRALHA: `b02e2726-7e7e-443f-9e60-9ae37ec072b2`, Meet `uqz-jgsx-qww`
- Mesmo `recording_drive_file_id`: `1d9LIv-PGkazvgjEq2b2qLVkxcUjKd9ub`

Também ainda existem outros 4 arquivos duplicados em eventos com códigos de Meet diferentes. Isso indica que a limpeza anterior não é suficiente enquanto o reprocessamento puder escolher um arquivo já usado por outra reunião.

## Plano de correção

1. **Blindar o matcher de gravações**
   - Manter a exigência de código de Meet no nome quando o evento tem `conference_id`.
   - Adicionar uma segunda trava: antes de aceitar um arquivo, verificar se o mesmo `recording_drive_file_id` já está vinculado a outro `calendar_event` com `conference_id` diferente.
   - Se estiver, rejeitar o arquivo para o evento atual e marcar como não encontrado/ambíguo, em vez de recriar vínculo cruzado.

2. **Corrigir a massa de dados atual**
   - Remover novamente os vínculos duplicados atuais, preservando apenas vínculos seguros.
   - Para arquivos compartilhados por eventos com códigos de Meet diferentes, zerar `recording_drive_file_id`, `recording_url`, `recording_mime_type`, `recording_synced_at` e `recording_status` nos eventos ambíguos.
   - Resetar tentativas para permitir reprocessamento apenas com a nova regra.

3. **Prevenir duplicidades futuras no banco**
   - Criar uma proteção estrutural parcial para evitar que o mesmo `recording_drive_file_id` fique associado a múltiplos eventos ao mesmo tempo, quando isso for seguro para o modelo atual.
   - Se houver algum caso legítimo de múltiplos eventos para o mesmo arquivo, usar uma regra mais conservadora via função de limpeza/validação em vez de índice único global.

4. **Validar a timeline do deal NEXID**
   - Consultar `get_entity_timeline('deal', 'f6c61100-1e8e-4ef3-a224-ceaf055f07d0')` após a limpeza.
   - Confirmar que o evento NEXID ainda aparece como reunião, mas sem a gravação da GRALHA.
   - Confirmar que não há mais `recording_drive_file_id` duplicado em `calendar_events`.

5. **Reprocessamento seguro**
   - Depois da correção estar publicada, rodar o tick de gravações ou orientar o uso do botão “Sincronizar gravações”.
   - Validar que gravações só voltam quando o arquivo contém o código correto do Meet ou não conflita com outro evento.

## Arquivos/áreas previstas

- `src/lib/calendar/engine.server.ts`: regra de seleção e rejeição de gravação já usada por outro evento/conference_id.
- Banco `calendar_events`: limpeza dos vínculos cruzados atuais.
- Opcional, se viável após checagem final: migration de proteção contra duplicidade de `recording_drive_file_id`.

## Resultado esperado

Ao abrir `/deals/f6c61100-1e8e-4ef3-a224-ceaf055f07d0`, a reunião NEXID pode continuar na timeline, mas a gravação da GRALHA não será exibida nem poderá ser reassociada automaticamente ao evento NEXID.