## Plano para corrigir a captura incompleta do TechHire Hunter

### Problema confirmado
A captura está falhando antes de chegar ao TechHire: na própria sidebar da extensão o perfil aparece com nome, mas cargo, empresa e localização ficam como `—`. Ou seja, o endpoint está recebendo payload incompleto; não é problema principal da lista de candidatos.

### Entrega proposta
Corrigir somente a extensão e o empacotamento, sem alterar banco, RLS, autenticação, regras de negócio ou integrações existentes.

### 1. Melhorar a leitura do top card do LinkedIn
- Ajustar o `topCardScope()` para capturar o container real do perfil, não apenas o `div` imediato do `h1`.
- Adicionar fallback que usa o bloco visual maior do topo do perfil quando `section.artdeco-card` não existir ou estiver fora do escopo.
- Ler `innerText` do container e não apenas seletores frágeis.

### 2. Extrair campos por texto visível, não só por classes
- Cargo/headline: buscar pelos seletores atuais e, se falhar, derivar a linha imediatamente abaixo do nome no bloco do topo.
- Localização: detectar linha com padrão de cidade/estado/país e remover ruídos como “Dados de contato”, conexões e seguidores.
- Empresa: priorizar links `/company/`, botões/aria-labels e, se necessário, inferir pelo painel direito de “experiência/empresa atual” visível no top card.
- Usar heurísticas conservadoras para não capturar “Destaques”, “Conectar”, “Mensagem” ou textos de botões.

### 3. Impedir salvamento incompleto por clique precoce
- Se o usuário clicar em “Salvar candidato” enquanto só há nome, a extensão fará uma última re-detecção síncrona antes de enviar.
- Se ainda faltar cargo e localização/empresa, manter a confirmação explícita: mostrar aviso e pedir para clicar novamente para salvar parcial, em vez de salvar incompleto sem fricção.
- Isso evita novos candidatos só com nome quando a extração ainda não terminou.

### 4. Melhorar feedback visual da sidebar
- Mostrar status de detecção: “Detectando detalhes…” enquanto ainda falta cargo/empresa/local.
- Trocar o aviso atual para uma mensagem mais objetiva quando o LinkedIn não expõe algum campo.
- Manter o botão “Re-detectar”.

### 5. Atualizar versão e ZIP
- Bump da extensão para `0.2.4`.
- Regerar `public/techhire-hunter.zip`.
- Ajustar o README, se necessário, para orientar reinstalação/reload da extensão.

### 6. Validação
- Validar o parsing com um fixture local baseado no HTML/texto visível do print enviado.
- Confirmar que o payload final teria:
  - `full_name`: Juliana C.
  - `current_position`: Especialista Growth Marketing | Marketing | Aquisição | Performance & Mídia | CRM | Mídias Digitais | IA aplicada a regra de negócio
  - `location`: São Bernardo do Campo, São Paulo, Brasil
  - `current_company`: Growth Lead - Assessoria de Marketing de Performance, quando detectável no bloco visível
- Rodar checagens estáticas aplicáveis sem alterar escopo.

### Arquivos previstos
- `extension/content.js`
- `extension/manifest.json`
- `extension/README.md`, se necessário
- `public/techhire-hunter.zip`

### Fora do escopo
- Não mexer em banco, RLS, API keys, autenticação, migrations ou server functions.
- Não alterar o layout da tela `/candidates`.
- Não prometer extração de e-mail/telefone do LinkedIn quando esses dados não estão visíveis no perfil.