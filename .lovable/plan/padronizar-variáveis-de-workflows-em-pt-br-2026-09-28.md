# Padronizar variáveis de Workflows em PT-BR

Traduzir as chaves mostradas e inseridas pelo seletor de variáveis, mantendo o formato `{{...}}`, sem acentos, em minúsculas e com espaços convertidos em `_`.

Exemplos do resultado:

- `{{signature_document_id}}` → `{{id_documento_assinatura}}`
- `{{metadata}}` → `{{metadados_tecnicos}}`
- `{{deal.services}}` → `{{negocio.servicos}}`
- `{{steps.1.title}}` → `{{passos.1.titulo}}`
- `{{vars.nome}}` → `{{variaveis.nome}}`

## Implementação

1. **Catálogo central de nomes em português**
   - Criar uma função única que gere chaves estáveis a partir dos rótulos PT-BR já existentes.
   - Normalizar para minúsculas, remover acentos, trocar espaços e separadores por `_` e preservar o contexto de associações.
   - Definir aliases explícitos para termos especiais e compostos, evitando traduções automáticas ambíguas.

2. **Seletor de variáveis**
   - Fazer o seletor inserir somente a versão amigável em PT-BR nos novos campos configurados.
   - Aplicar o padrão aos campos do registro, associações, itens do negócio, variáveis do fluxo e saídas de passos anteriores.
   - Atualizar exemplos, textos auxiliares e placeholders do editor para não expor nomes técnicos em inglês.

3. **Compatibilidade com workflows existentes**
   - Manter todas as chaves técnicas atuais como aliases válidos no motor, sem regravar workflows salvos.
   - Resolver a nova chave PT-BR para o mesmo campo interno antes da leitura do valor.
   - Aceitar simultaneamente, por exemplo, `{{deal.services}}` e `{{negocio.servicos}}`.
   - Preservar nomes definidos manualmente pelo usuário em “Formatar dados”, normalizando apenas o prefixo estrutural `vars`/`variaveis`.

4. **Proteções e casos especiais**
   - Detectar colisões entre rótulos normalizados dentro do mesmo contexto e usar um alias explícito único.
   - Manter campos técnicos/sensíveis fora das sugestões normais; a tradução não deve torná-los mais visíveis.
   - Atualizar a detecção de itens do negócio para reconhecer nomes antigos e novos, garantindo a hidratação dos dados.
   - Preservar valores, IDs, estrutura do workflow e comportamento das automações.

## Validação

- Testes unitários para normalização, aliases, associações, itens do negócio, passos anteriores e compatibilidade retroativa.
- Confirmar no editor que busca, seleção e inserção mostram apenas as novas chaves em PT-BR.
- Abrir um workflow antigo e confirmar que suas variáveis técnicas continuam resolvendo sem alteração.
- Executar testes focados de Workflows, verificação de tipos, lint dos arquivos alterados e build monitorado.
- Validar o fluxo no desktop e no celular, sem salvar ou publicar uma automação real.

## Escopo

- Sem migration, alteração de banco, RLS, permissões, estrutura de workflow ou regra de negócio.
- Nenhuma funcionalidade será removida; a mudança é aditiva e retrocompatível.
