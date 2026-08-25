# Corrigir acesso de Sabrina aos arquivos do TechContracts

## Diagnóstico confirmado

- Sabrina e Guilherme pertencem ao mesmo workspace ativo com papel `admin`.
- Sabrina possui **Workspace Admin** e o conjunto extra **Super Admin**; ambos têm exatamente **1.648 permissões efetivas**, incluindo as 31 permissões de TechContracts e `techcontracts.contracts.view.workspace`.
- A tabela `contracts` permite leitura aos membros do workspace e Sabrina já pode consultar os registros. Portanto, papéis, permissões efetivas e RLS dos contratos não são o bloqueio.
- Os PDFs ficam no bucket privado `contract-imports`. A policy atual de leitura exige `storage.objects.owner = auth.uid()`.
- Os arquivos existentes foram enviados por Guilherme e permanecem com Guilherme como proprietário. Ao solicitar a URL com a sessão de Sabrina, o armazenamento oculta o objeto e retorna **“Object not found”**.
- “Super Admin” é um conjunto de permissões do workspace; ele não altera a propriedade física dos arquivos. Guilherme também é administrador de plataforma, mas o acesso atual funciona porque ele é o proprietário dos uploads analisados.

## Implementação

### 1. Autorizar o contrato antes de liberar o arquivo

- Manter `getContractSourceFileUrl` autenticada.
- Consultar o contrato com o cliente da própria sessão, preservando RLS e isolamento por workspace.
- Só continuar quando o contrato e seu `source_file_path` forem visíveis para o usuário.

### 2. Assinar o arquivo no servidor após a autorização

- Depois da leitura autorizada do contrato, gerar a URL temporária com o cliente privilegiado somente no servidor.
- Carregar esse cliente dinamicamente dentro do handler para preservar a fronteira servidor/cliente.
- Não ampliar o bucket para acesso público e não criar uma policy genérica de leitura entre usuários.
- Preservar validade curta da URL assinada e não retornar caminhos de arquivos de outros contratos.

### 3. Melhorar o erro de arquivo realmente ausente

- Diferenciar “sem acesso ao contrato” de “contrato sem arquivo” e “objeto não encontrado no armazenamento”.
- Exibir mensagem acionável no visualizador quando o registro aponta para um arquivo que não existe mais, sem expor detalhes internos.

### 4. Validar o fluxo completo

- Confirmar que Sabrina continua vendo a mesma listagem de contratos permitida pelo workspace.
- Abrir como Sabrina um PDF existente enviado por Guilherme e validar visualização e download.
- Validar que um usuário externo ao workspace não consegue obter a URL pelo ID do contrato.
- Validar um contrato sem arquivo e um caminho órfão.
- Executar os testes e verificações disponíveis relacionados ao módulo.

## Escopo e segurança

- Alteração restrita ao acesso aos arquivos originais de TechContracts.
- Sem mudança nos papéis de Sabrina, catálogo de permissões, RLS da tabela `contracts` ou visibilidade de outros módulos.
- Sem tornar documentos públicos e sem conceder leitura ampla no armazenamento.
- A autorização continua sendo definida pelo acesso ao registro do contrato no backend; a assinatura privilegiada ocorre somente depois dessa confirmação.
