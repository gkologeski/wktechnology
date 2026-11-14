# CORPO-FALHA — corrigir importação que não traz o corpo e falha na 2ª tentativa

Porte P/M — estimativa 30–45 min (diagnóstico 10–15 min + correção 15–20 + Ajuda/testes 10).

## O que já foi verificado (somente leitura)
- Nenhum contrato importado foi criado hoje: o último rascunho de importação é de 26/10, sem corpo. As duas tentativas de hoje não chegaram a gravar o rascunho (ou usaram o fluxo de reimportação numa ficha existente — a confirmar).
- A mensagem "Falha na extração" é genérica: aparece para qualquer erro da IA, do envio do arquivo, da leitura do PDF ou da criação do rascunho, escondendo a causa real.
- A leitura do corpo do PDF depende de um componente carregado no navegador; se ele falhar, o corpo some sem aviso claro.

## Etapas
1. Reproduzir no navegador (Playwright) a importação de um PDF e de um DOCX, capturando a mensagem real e as chamadas ao servidor; se possível usar o mesmo arquivo do usuário (pedir se não houver cópia).
2. Corrigir a causa encontrada. Hipóteses a confirmar: corpo maior que o limite aceito pelo servidor (400 mil caracteres) derrubando o rascunho; falha ao carregar o leitor de PDF; tentativa repetida reaproveitando estado anterior do diálogo.
3. Tornar o corpo "não fatal": se a leitura do corpo falhar ou passar do limite, o rascunho é criado mesmo assim com aviso; corpo longo é truncado com nota.
4. Mensagens de erro por etapa (IA, envio do arquivo, leitura do texto, gravação) em vez de "Falha na extração".
5. Teste do limite/truncamento e da conversão; atualizar artigo "Importar contrato" da Ajuda (bump de versão) e hash no registro de permissões (sem permissão nova).

## Fora do escopo
Importação em lote; regras de acesso; banco.
