# Bloquear "Ligação" quando a telefonia não aceita as credenciais

## Por que aparece como liberado hoje
A verificação do botão só confere se as chaves da telefonia estão preenchidas e no formato certo. Elas estão, mas a telefonia recusa a combinação (erro 401). A janela de ligação faz o teste real e mostra o erro, o botão não faz.

## O que muda
- O teste do botão passa a ser o mesmo da janela: pergunta à telefonia se as chaves são aceitas.
- Se forem recusadas (ou estiverem faltando), "Ligação" fica esmaecido, com a engrenagem que leva à configuração e a dica "Telefonia com credenciais inválidas".
- O resultado fica guardado por alguns minutos, então o teste não roda a cada abertura de página.
- Se a telefonia estiver fora do ar ou demorar, o botão continua liberado e a janela mostra o aviso atual, como já acontece com os outros canais.

## Fora do escopo
- Consertar as chaves: você precisa gerar uma nova chave de API no painel do Twilio (na mesma conta) e atualizar as duas informações (identificador e segredo). Posso abrir o formulário seguro depois.
- Nenhuma mudança no banco, permissões ou no envio.

## Detalhes técnicos
- Extrair a sonda `GET /Accounts/{AC}/Keys/{SK}.json` de `getVoiceAccessToken` para `src/lib/twilio-voice-probe.server.ts` (`probeTwilioVoiceCredentials()` → `{ ok, reason }`), reutilizada pelas duas server functions.
- `getChannelAvailability`: `call` = `twilioEnvReady` && probe ok; 401/404 → `ready:false` com motivo; erro de rede/timeout (AbortSignal ~3s) → `ready:true`.
- Validação: tsgo, ESLint, teste unitário do mapeamento de status da sonda, verificação no navegador do botão bloqueado.
