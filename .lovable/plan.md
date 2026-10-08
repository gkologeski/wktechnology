# Importação por link: tratar bloqueio de sites como LinkedIn

## Diagnóstico
O erro 429 ("muitas solicitações") vem do próprio LinkedIn, não do TechERP. O LinkedIn recusa leituras automáticas de vagas feitas por servidores, então o link nunca vai funcionar de forma confiável. Hoje a tela mostra só "A página respondeu com erro 429.", sem dizer o que fazer.

Não vamos burlar o bloqueio. Isso violaria os termos do LinkedIn e falharia de novo.

## O que muda
1. Mensagem clara quando o site recusa a leitura (429, 403, 999 ou login exigido): "Este site bloqueia leitura automática. Copie o texto da vaga e cole na opção Texto, ou envie um PDF ou print."
2. Aviso prévio: ao colar um link do LinkedIn, Indeed, Glassdoor ou Gupy, a tela já sugere colar o texto ou enviar print antes de tentar.
3. Botão "Colar texto em vez disso" no aviso de erro, que abre a importação por texto com o link guardado como fonte.
4. Sem novas tentativas automáticas em respostas 429 de sites externos.

## Como validar
- Importar o link do LinkedIn mostra a mensagem nova e o botão de alternativa.
- Colar o texto da mesma vaga gera a proposta normalmente.
- Links comuns de páginas públicas continuam funcionando.

## Detalhes técnicos
- `src/lib/surveys/import/import.server.ts` linhas 53–55: mapear 429/999/redirect para login em erro amigável com código `SITE_BLOCKED`. Pesquisas reaproveitam o mesmo texto.
- UI de importação dos perfis: tratar `SITE_BLOCKED` e mostrar a lista de domínios conhecidos (só para o aviso, sem bloquear).
- Teste unitário do mapeamento de status para mensagem.
