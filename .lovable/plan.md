
# Envio assistido de mensagens do LinkedIn (Caminho A)

Fechar o ciclo **capturar → escolher template → preencher no LinkedIn → enviar → registrar** sem violar ToS. O recrutador continua sendo quem clica em "Enviar"; a extensão automatiza o trabalho braçal (abrir composer certo, colar mensagem renderizada, detectar envio, registrar na timeline).

Sem mudanças em RLS, schema (apenas colunas aditivas opcionais), autenticação ou regras de negócio existentes.

## Escopo

Em escopo:
- 3 modos de envio: **Mensagem direta** (1º grau), **Convite com nota** (não-conexão), **InMail** (Premium/Recruiter)
- Botão "Preparar mensagem" na sidebar da extensão, ao lado do "Copiar"
- Auto-detecção do contexto (se já é conexão, se tem botão InMail, etc.)
- Pré-preenchimento do textarea respeitando limites do LinkedIn (300 chars no convite, ~1900 chars na mensagem, ~2000 no InMail subject+body)
- Detecção do clique em "Enviar" do LinkedIn e log automático em `activities` + `last_touch_at` do candidato
- Estado visual na sidebar: "Pronto para enviar" / "Enviado às HH:mm" / "Falha ao detectar envio"
- Fallback manual: botão "Já enviei" se a detecção falhar

Fora de escopo:
- Envio 100% automatizado sem clique humano (viola ToS)
- LinkedIn Messaging API oficial (depende de Partner Program)
- Mensagens em massa / fila / agendamento (fica para sequences existentes)
- Anexos, GIFs, voice notes
- Conversas em andamento (responder thread já aberta)

## Entregas

### 1. Extensão `v0.3.0` — `extension/content.js` + nova `extension/messenger.js`

Novo módulo `messenger.js` com 3 estratégias, selecionadas pelo contexto do perfil:

**a) `sendDirectMessage(text)`** — perfis de 1º grau
- Localiza botão "Mensagem" no top card (heurística por aria-label `Mensagem|Message` + `pvs-profile-actions`)
- Clica, espera o overlay `.msg-overlay-conversation-bubble` abrir
- Preenche `div[role="textbox"][contenteditable="true"]` via `InputEvent` (LinkedIn ignora `value=` direto)
- Não clica em enviar — apenas habilita o botão e foca

**b) `sendConnectionRequest(text)`** — perfis fora da rede
- Clica "Conectar" (ou abre menu "Mais" → "Conectar" se estiver oculto)
- Modal "Adicionar nota" → preenche `#custom-message` (max 300 chars; trunca + avisa)
- Não clica em "Enviar convite"

**c) `sendInMail(subject, body)`** — apenas se botão "InMail" existir
- Abre composer InMail, preenche subject + body
- Trunca subject em 200, body em 1900

Cada função retorna `{ ok, mode, truncated, finalLength }`.

### 2. Detecção de envio

Listener no `messenger.js`:
- Para mensagem direta: observa o `MutationObserver` na lista de mensagens da conversa aberta; novo `li.msg-s-message-list__event` com texto igual ao colado = enviado.
- Para convite: detecta toast `"Convite enviado"` ou fechamento do modal sem erro.
- Para InMail: detecta toast `"InMail enviado"`.
- Timeout de 5 min — se nada detectado, fica em "Aguardando confirmação" com botão **"Já enviei"** / **"Cancelar"**.

Em qualquer confirmação, dispara `chrome.runtime.sendMessage({ type: "LOG_OUTREACH", payload: { linkedin_url, channel, body, detected: true } })`.

### 3. Sidebar UI (`extension/sidebar.css` + injetada por `content.js`)

Substitui o atual botão único "Copiar" por:
- Select de template (já existe)
- Preview renderizado com contador `123/300` colorido conforme o modo
- Botão primário **"Preparar no LinkedIn"** (texto muda conforme modo detectado: "Preparar mensagem" / "Preparar convite" / "Preparar InMail")
- Botão secundário **"Copiar"** (mantém fluxo atual como fallback)
- Status pill: `idle | preenchido | aguardando_envio | enviado | falhou`

### 4. Backend — endpoint público `log-outreach` (já existe)

Adições mínimas em `src/routes/api/public/hunting/log-outreach.ts`:
- Aceitar campos opcionais: `template_id` (uuid), `detected` (bool), `final_length` (int), `truncated` (bool)
- Persistir em `activities.description` como bloco estruturado curto (sem nova coluna)
- Resposta retorna `activity_id` para a extensão referenciar

Sem mudança de schema; sem nova policy; sem RLS nova. `ats_candidates.last_touch_at` já é atualizado.

### 5. TechHire — visibilidade do outreach

Na página `/captures` (e drawer do candidato em `/candidates`), garantir que a `ActivityTimeline` já existente mostra os outreaches `type: "outreach"` com o canal e o modo detectado. **Não cria componente novo** — só verifica se o filtro de tipos inclui `outreach` (provavelmente já inclui).

### 6. Pacote e documentação

- `extension/manifest.json` → `version: "0.3.0"`
- `extension/README.md` → seção "Enviar mensagens", explicando que o recrutador **sempre confirma o envio** dentro do LinkedIn, e os 3 modos suportados
- Regenerar `public/techhire-hunter.zip`
- Atualizar `/hunting/install` com nota da nova versão e changelog curto

## Validação

Antes de fechar:

1. **Typecheck + build** (`bun run typecheck`, `bun run build`) — só se afetar src/.
2. **Teste manual roteirizado** em 3 perfis (1º grau, fora da rede, com InMail), documentado no PR:
   - Captura
   - Selecionar template
   - "Preparar no LinkedIn"
   - Confirmar pré-preenchimento e contador
   - Enviar manualmente
   - Verificar atividade na timeline do candidato
3. **Teste de truncamento**: template > 300 chars no modo convite mostra aviso e trunca.
4. **Teste de fallback**: clicar "Já enviei" sem envio real registra mesmo assim.
5. **Smoke da extensão** com fixture HTML (script em `/tmp/browser/techhire-hunter/`) — valida seletores do composer não quebraram.

## Riscos e mitigação

- **Seletores do LinkedIn mudam**: mesmo problema da extração. Mitigação: heurísticas em camadas (aria-label PT/EN, role, classes), erro visível na sidebar com instrução "atualize a extensão" se falhar.
- **Limite de chars**: tratado com truncamento + aviso visível antes do envio.
- **ToS**: humano clica enviar; não há auto-click. Documentado no README.
- **InMail sem Premium**: botão "Preparar InMail" só aparece se o LinkedIn renderizar o botão InMail no perfil.
- **Detecção falsa**: fallback "Já enviei" + timeout de 5 min com possibilidade de cancelar.

## Pendências conhecidas (fora desta entrega)

- Sequências automatizadas multi-touch via LinkedIn (depende de fila + cron + ainda assim precisa humano)
- Replies/threading (LinkedIn não expõe DOM estável o suficiente para detectar respostas confiavelmente)
- Integração oficial via Partner Program — roadmap de longo prazo

## Próximo passo

Aprovação para implementar. A entrega sai como uma única release da extensão (`v0.3.0`) + ajuste mínimo no endpoint público, sem migration.
