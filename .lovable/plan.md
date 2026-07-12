## Fase A — Diagnóstico da gravação ausente

**Alvo:** evento `c2124ade-99d8-4f75-87c6-71c40b5722ed` — "WK Technology <> LUMINA/NORA TECNOLOGIA LTDA", Meet `guh-vibx-qrp`, 07/07/2026 14:30 BRT, organizador `guilherme@wktechnology.com.br`.

Estado atual no banco: `recording_status = not_found`, 13 tentativas, erro "nenhuma gravação com o código do Meet 'guh-vibx-qrp' na janela de busca". O matcher exige, por segurança, que o nome do arquivo no Drive contenha `guh-vibx-qrp` dentro da janela `end_at −1h … +6h`.

### Passos (sem alterar código)

1. **Confirmar se a reunião foi gravada**
   - Abrir Google Meet / histórico do organizador (`guilherme@wktechnology.com.br`) para 07/07 14:30.
   - Se ninguém clicou em "Gravar reunião", encerrar Fase A — não existe gravação a associar. Marcar o evento como "sem gravação" na timeline.

2. **Se foi gravada, localizar o arquivo no Drive**
   - No Drive do organizador, procurar em "Meu Drive → Meet Recordings" por qualquer arquivo criado entre 07/07 14:30 e 07/07 21:00 (janela ampla).
   - Verificar o nome do arquivo. Padrão esperado do Meet: `guh-vibx-qrp (2026-07-07 …).mp4`.

3. **Diagnóstico do nome**
   - **(a) Nome já contém `guh-vibx-qrp`** e mesmo assim não foi achado → possíveis causas: arquivo fora do "Meu Drive" do organizador (foi movido para Drive compartilhado sem permissão para a conta conectada) OU criado fora da janela `end_at +6h` (reunião muito longa / upload atrasado). Ação: mover para o Meu Drive do organizador e rodar reconcile manual.
   - **(b) Nome foi renomeado** (perdeu o código) → o matcher rejeita por design (evita cross-linking). Ação: renomear o arquivo de volta contendo `guh-vibx-qrp` ou usar o botão manual de vínculo (Fase C).
   - **(c) Arquivo está em Drive de outro participante** que não tem conta conectada no CRM → nada a fazer sem conectar essa conta.

4. **Ampliar a janela de busca (diagnóstico via servidor)**
   Rodar uma varredura ampla no Drive do organizador para descartar hipóteses (a) e (c) — nenhum arquivo de mídia criado no dia 07/07 na faixa 14:00–22:00 BRT com "LUMINA", "NORA", "guh", "vibx" ou "qrp" no nome. Se aparecer algo, decidir se é a gravação e vincular manualmente. Essa varredura será feita chamando a `driveSearch` existente (sem novo código; apenas um script de diagnóstico descartável executado no ambiente do agente com o token do `calendar_accounts` do organizador).

5. **Se localizado, forçar reconcile do evento**
   Chamar a função existente que vincula recording para um evento específico (a mesma usada pelo botão "sincronizar gravações" da UI) passando `event_id = c2124ade-…`. Isso reseta `recording_attempts` e reprocessa. Confirmado o vínculo, a gravação aparece na timeline do contato Janderson (e, com a Fase B/C, no card do deal).

### Entregáveis da Fase A

- Relatório curto do que foi encontrado (foi gravada? nome do arquivo? em qual Drive?), com o diagnóstico final entre (a)/(b)/(c) ou "não gravada".
- Se aplicável, o evento `c2124ade` fica com `recording_status = available` e `recording_url` preenchido.
- Lista de outras reuniões do mesmo dia (`dnv-mwpv-vpe`, `oog-uvqa-rrh`) que provavelmente compartilham a mesma causa raiz, para o usuário aplicar o mesmo tratamento em lote.

### Fora do escopo desta fase

- Nenhuma mudança em `engine.server.ts`, RLS, RPCs ou UI.
- Nada de alterar `related_deal_id` do evento (isso é a **Fase B**).
- Nada de adicionar bloco "Reuniões via contato/empresa" no card do deal (**Fase C**).

### Como validar manualmente ao final

- Abrir `/deals/288e0f30-edfb-474e-97f4-0432da9e6b63` → timeline do contato Janderson deve mostrar a reunião de 07/07 com o player de vídeo se a gravação foi localizada.
- `SELECT recording_status, recording_url FROM calendar_events WHERE id='c2124ade-…'` deve retornar `available` + URL do Drive (ou permanecer `not_found` com a razão clara).

### Próximo passo (não executar automaticamente)

Após concluída a Fase A, decidir se seguimos para **Fase B** (mostrar reuniões do contato/empresa no card do deal) e **Fase C** (bloco dedicado com status da gravação e ação manual de re-vincular).
