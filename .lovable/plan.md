# Eliminar valores chumbados por fases

## Objetivo

Revisar o código inteiro, classificar cada valor fixo e corrigir somente os que deveriam vir de ambiente, workspace, banco, domínio ou design system. Valores fixos legítimos — protocolos externos, enums canônicos, limites oficiais de provedores, presets editáveis e dados de teste — serão documentados, não removidos indiscriminadamente.

## Achados já confirmados

### Prioridade crítica

- Há três URLs ligadas diretamente ao identificador deste projeto em caminhos de produção: execução manual de auditoria de segurança, campanha de prospecção/Vapi e links de campanhas de e-mail. Em clones ou outro ambiente, podem chamar ou divulgar a instância errada.
- O fluxo de auto-upgrade altera a assinatura para `active` e retorna `mock: true`, sem cobrança real. Esse comportamento precisa ser isolado como demonstração ou bloqueado fora de ambiente explicitamente permitido.
- O módulo bancário inicia o Banco Inter sempre em modo `mock`; a própria tela informa que o saldo e extrato são simulados. Deve continuar claramente separado de qualquer estado de produção até existir integração real.

### Prioridade alta

- Convites atribuem cargos por quatro UUIDs fixos. A lógica depende de esses registros existirem com exatamente os mesmos identificadores; a correção deve usar uma chave estável de negócio e falhar de forma explícita se o cargo padrão não existir.
- Domínios próprios aparecem repetidos em metadados, links públicos, webhooks, OAuth e remetentes de e-mail, apesar de já existir um resolvedor central de URL. A origem adequada varia entre domínio canônico da plataforma, host atual e domínio verificado de envio; não serão todos substituídos pela mesma regra.
- O Dashboard de Vendas calcula o dia em GMT-3 fixo. Isso é coerente com a regra atual de Brasília, mas impede que outro workspace use seu próprio fuso; será centralizado e preparado para configuração por workspace sem alterar o resultado atual.

### Prioridade média

- Quota de arquivos (100 MB), exportação do Painel de IA (até 5.000 chamadas), paginações, lotes, timeouts e limites de anexos estão espalhados pelo código. Serão classificados entre regra de produto, limite técnico e limite oficial de provedor antes de qualquer mudança.
- Há cores de fallback e dimensões avulsas em projetos, workflows, grupos, editor de cotações e widget público. Paletas escolhidas pelo usuário e HTML destinado a e-mail/documento são casos distintos de cores indevidas na interface e serão tratados separadamente.
- Algumas listas fixas são intencionais, como moedas disponíveis, fases legadas e catálogos de provedores; elas serão consolidadas apenas quando houver fonte canônica existente, sem transformar enums válidos em configuração dinâmica desnecessária.

## Execução por fases

### Fase 1 — Inventário verificável

1. Criar uma auditoria automatizada por categorias: possíveis segredos/IDs, URLs próprias, mocks, regras de negócio, fusos/datas, limites, cores/layout e catálogos.
2. Gerar um relatório versionado com arquivo, linha, classificação, impacto, origem correta e decisão: corrigir, manter documentado ou revisar com produto.
3. Adicionar uma lista de exceções justificadas para impedir falsos positivos recorrentes em testes, protocolos externos, e-mails renderizados e presets de branding.

### Fase 2 — Segurança, ambiente e produção

1. Remover URLs com identificador de projeto dos fluxos de segurança, campanhas de e-mail e Vapi; resolver a origem por configuração segura e falhar claramente quando ela for obrigatória.
2. Centralizar as categorias de URL: origem pública atual, domínio canônico, callback externo e domínio de remetente, preservando as regras específicas de OAuth e webhooks.
3. Proteger auto-upgrade e Banco Inter mock com estado explícito de demonstração/configuração; nenhum mock poderá produzir aparência de cobrança ou conexão bancária real.
4. Substituir UUIDs de cargos por resolução validada de chave estável, mantendo permissões e isolamento atuais.

### Fase 3 — Regras por workspace e limites

1. Centralizar o fuso padrão e permitir que cálculos de data usem o fuso do workspace quando disponível, mantendo `America/Sao_Paulo` como fallback compatível.
2. Reunir quotas, tamanhos, paginações, lotes e timeouts em catálogos tipados por domínio.
3. Tornar configuráveis apenas regras de produto que realmente variam por plano/workspace; limites técnicos ou oficiais permanecem constantes e documentados.
4. Garantir que exportações maiores paginem no servidor, sem depender de um teto silencioso como 5.000 registros.

### Fase 4 — Interface, branding e conteúdo

1. Trocar fallbacks visuais indevidos por tokens semânticos ou cores do workspace, preservando cores de status e valores escolhidos em editores.
2. Tornar o widget público configurável pelo workspace para cor, posição e dimensões dentro de limites acessíveis.
3. Consolidar rótulos/opções repetidos em catálogos canônicos quando já houver uma fonte compartilhada.
4. Revisar desktop, celular, tema claro/escuro, contraste, foco e estados vazios/indisponíveis.

### Fase 5 — Prevenção

1. Adicionar verificações no pipeline para impedir novos identificadores de projeto, credenciais literais, domínios próprios fora das exceções e cores avulsas em telas comuns.
2. Criar testes para resolução de URLs, fuso, cargos padrão, bloqueio de mocks e limites centralizados.
3. Registrar no guia técnico como introduzir constantes legítimas e como externalizar configuração sem expor segredos.

## Escopo preservado

- Sem trocar endpoints oficiais de Google, Meta, Twilio, OpenAI e demais provedores apenas por serem literais.
- Sem remover enums, presets de cor escolhíveis, conteúdo de teste ou limites contratuais de integrações.
- Sem ativar cobrança ou conexão bancária real sem credenciais, contrato e aprovação específicos.
- Alterações de banco só serão usadas se uma configuração por workspace não tiver fonte persistida existente; qualquer necessidade será apresentada separadamente antes da migration.
- Nenhuma mudança de RLS, papel ou permissão será feita além de preservar a resolução segura dos cargos já existentes.

## Validação

- Testes unitários por categoria e regressão completa.
- Typecheck, lint, formatação, build e verificação de diff.
- Testes no navegador dos fluxos afetados com dados reais, sem considerar mock como integração validada.
- Busca final deve encontrar apenas valores constantes classificados e justificados no relatório de exceções.
