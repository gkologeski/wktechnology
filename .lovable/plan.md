## Plano de correção controlada — TechHire Hunter não detecta cargo/empresa/local

### Objetivo
Corrigir a extensão para capturar, no mínimo, nome, headline/cargo, empresa e localização visíveis no topo do perfil do LinkedIn, evitando o erro `Extension context invalidated` e melhorando a capacidade de diagnóstico quando o DOM do LinkedIn mudar.

### Diagnóstico provável
Pelas imagens, os dados estão claramente visíveis na tela, mas a extensão só lê o nome. O problema está no `extension/content.js`:
- o `topCardScope()` provavelmente escolhe um container pequeno demais, que contém o `h1`, mas não contém os blocos de headline, localização e empresa;
- a heurística de empresa depende muito de link `/company/`, mas no topo do LinkedIn atual a empresa aparece em blocos laterais com texto/imagem e nem sempre como link limpo;
- o erro `Extension context invalidated` aparece quando a extensão é recarregada/atualizada enquanto um content script antigo ainda roda no LinkedIn. Isso deve ser tratado defensivamente para não quebrar callbacks e timers.

### Implementação proposta

1. **Reescrever a seleção do Top Card**
   - Priorizar containers reais do LinkedIn atual: `.pv-top-card`, `.ph5.pb5`, `.mt2.relative`, `section:has(h1)` quando disponível.
   - Se não encontrar, subir a partir do `h1` até um container que contenha simultaneamente nome, headline e localização.
   - Evitar containers que incluam seções abaixo como `Destaques`, `Experiência`, `Atividade` ou sidebar de recomendações.

2. **Extrair por layout visual, não só por seletores antigos**
   - `headline`: pegar a primeira linha útil logo abaixo do `h1`, incluindo casos como `Account Manager | Telecom... at 3CORP TECHNOLOGY`.
   - `location`: aceitar linhas como `Santana de Parnaíba, São Paulo, Brasil`, mesmo sem classes antigas.
   - `company`: primeiro tentar bloco lateral do top card; depois extrair do headline por `at`, `em`, `na`, `no`, `@`; depois fallback em linhas próximas que pareçam nome de empresa.

3. **Adicionar fallback por texto normalizado da página**
   - Quando o card falhar, usar uma janela de texto próxima ao nome dentro do `main`.
   - Remover ruído: botões, conexões, idiomas, sugestões, template da extensão, recomendações e seções abaixo.
   - Preservar apenas dados já visíveis ao usuário.

4. **Tratar `Extension context invalidated` sem quebrar a UI**
   - Criar wrappers seguros para `chrome.runtime.sendMessage`.
   - Antes de chamar APIs da extensão, validar se `chrome.runtime?.id` existe.
   - Se o contexto estiver inválido, mostrar mensagem clara: “Extensão recarregada. Recarregue a aba do LinkedIn.” em vez de gerar erro repetido.
   - Limpar observers/timers ao fechar sidebar ou ao detectar contexto inválido.

5. **Melhorar diagnóstico dentro da sidebar**
   - Incluir um pequeno modo técnico não intrusivo no preview: quando faltar campo, mostrar quais campos faltam.
   - Não expor dados sensíveis, tokens ou payloads de API.

6. **Atualizar versão e pacote**
   - Subir a extensão para `0.2.5` em `manifest.json` e `README.md`.
   - Regenerar `public/techhire-hunter.zip`.
   - Manter a página `/hunting/install` como está, pois o download já aponta para o ZIP público.

### Validação planejada
- Criar/rodar teste local com fixture HTML representando exatamente o caso da imagem:
  - Nome: `Antonio Andrade`
  - Headline: `Account Manager | Telecom, Cloud & Infra | B2B & Government at 3CORP TECHNOLOGY`
  - Localização: `Santana de Parnaíba, São Paulo, Brasil`
  - Empresa lateral: `3CORP Technology`
- Confirmar que `extractProfile()` retorna todos os campos.
- Verificar que não há escrita em banco, RLS, autenticação ou regras de negócio.

### Fora do escopo
- Não alterar banco de dados.
- Não alterar API pública de captura.
- Não alterar autenticação, API keys ou pareamento.
- Não automatizar envio de mensagens no LinkedIn.
- Não implementar scraping em background.