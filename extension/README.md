# TechHire Hunter — Extensão Chrome

Versão atual: 1.0.6

Extensão Manifest V3 que injeta uma sidebar nos perfis do LinkedIn (`linkedin.com/in/*`
e `linkedin.com/sales/lead/*`) permitindo:

- Capturar o candidato (nome, cargo, empresa, localização, URL) direto pro TechHire ATS.
- Capturar detalhes ricos quando disponíveis: experiência, educação, skills, idiomas, certificações e sinais de recrutamento.
- Listar templates de mensagem e renderizar com variáveis do perfil.
- **Preparar a mensagem dentro do LinkedIn** — abre o composer correto (mensagem
  direta, convite com nota ou InMail), pré-preenche o texto e respeita o limite
  de caracteres. Você revisa e clica **Enviar** no próprio LinkedIn.
- Detectar o envio (toast ou item novo na conversa) e registrar automaticamente
  na timeline do candidato. Se a detecção falhar, há botão "Já enviei".

## Envio assistido (v0.3.0)

A extensão **nunca clica em Enviar por você**. Os Termos de Uso do LinkedIn
exigem confirmação humana de cada mensagem; a extensão apenas:

1. Identifica o canal disponível (1º grau, fora da rede, Premium/Recruiter).
2. Abre o composer certo.
3. Cola o texto do template renderizado, truncando se exceder o limite
   (300 chars no convite, ~1900 na mensagem direta, ~1900 no InMail).
4. Observa o DOM por até 5 min e registra na timeline quando detecta envio.

Os 3 modos são: **Mensagem direta**, **Convite com nota**, **InMail**. O modo
"Detectar automaticamente" escolhe o melhor disponível.

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
