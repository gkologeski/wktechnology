# TechHire Hunter — Extensão Chrome

Versão atual: 0.2.5

Extensão Manifest V3 que injeta uma sidebar nos perfis do LinkedIn (`linkedin.com/in/*`
e `linkedin.com/sales/lead/*`) permitindo:

- Capturar o candidato (nome, cargo, empresa, localização, URL) direto pro TechHire ATS.
- Listar templates de mensagem e renderizar com variáveis do perfil.
- Copiar a mensagem renderizada (cole no chat do LinkedIn).
- Registrar o outreach na timeline do candidato.

## Por que extensão (e não iframe)
O LinkedIn envia `X-Frame-Options: DENY` — impossível embutir num iframe. Toda
captura acontece **no contexto da sua sessão autenticada do LinkedIn**, sob
demanda, quando você abre o perfil. Não há scraping em background.

## Instalação (modo desenvolvedor)
1. Clone/baixe esta pasta `extension/`.
2. Acesse `chrome://extensions` no Chrome ou Edge.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `extension/`.
5. Fixe a extensão na barra do navegador.

Ao atualizar uma versão já instalada, remova/recarregue a extensão em
`chrome://extensions` e recarregue a aba do LinkedIn antes de testar uma nova
captura.

## Pareamento
1. No TechHire, abra **Configurações · API keys** e gere uma chave pessoal.
2. Clique no ícone da extensão na barra. Informe:
   - **URL do TechHire** (ex: `https://app.lovable.app` ou seu domínio próprio).
   - **API key** colada.
3. Salvar. Recarregue uma aba do LinkedIn.

## Endpoints públicos consumidos
- `POST /api/public/hunting/capture` — payload do perfil.
- `POST /api/public/hunting/templates` — lista templates.
- `POST /api/public/hunting/render-template` — renderiza template com variáveis.
- `POST /api/public/hunting/log-outreach` — registra outreach.

Todos exigem header `Authorization: Bearer <api_key>`.

## Limites
- Respeite os Termos de Uso do LinkedIn. A extensão só lê o que **você** já vê.
- Cada captura é deduplicada por URL canônica em `ats_hunting_captures`.
- Mensagens não são enviadas automaticamente — você copia e cola no LinkedIn.
