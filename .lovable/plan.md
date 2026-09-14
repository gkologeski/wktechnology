# Guia visual de configuração do WhatsApp oficial

## Objetivo
Transformar `/settings/whatsapp` em uma configuração guiada, para que o usuário saiba onde localizar cada informação na Meta e em qual ordem concluir a conexão.

## Alterações propostas

### 1. Passo a passo visual antes do formulário
- Adicionar uma seção expansível “Como conectar seu WhatsApp” acima da configuração atual.
- Organizar o guia em etapas numeradas e objetivas:
  1. acessar as Configurações do Negócio da Meta;
  2. localizar e copiar o ID da conta do WhatsApp Business (WABA ID);
  3. criar ou selecionar um Usuário do Sistema;
  4. atribuir o aplicativo e controle total ao usuário;
  5. gerar o token permanente com `whatsapp_business_management` e `whatsapp_business_messaging`;
  6. colar WABA ID e token no TechERP e conectar;
  7. configurar o webhook e assinar os eventos necessários;
  8. sincronizar os números e definir o número padrão.
- Incluir alertas claros para não confundir WABA ID, Business ID e Phone Number ID.
- Informar que os nomes das opções da Meta podem variar ligeiramente conforme idioma e atualizações da plataforma.

### 2. Prints ilustrativos
- Criar uma sequência de imagens próprias e anotadas, em português, destacando visualmente onde clicar e onde copiar cada dado.
- Cobrir: Conta do WhatsApp/WABA ID, Usuário do Sistema, geração do token e configuração do webhook.
- Exibir cada print com legenda, texto alternativo acessível e opção de ampliar.
- Guardar as imagens localmente no projeto, sem depender de links externos e sem mostrar contas, IDs ou tokens reais.

### 3. Melhorias práticas na configuração
- Adicionar links externos identificados para abrir diretamente as Configurações do Negócio e o painel de aplicativos da Meta.
- Adicionar ação de copiar na URL do webhook.
- Manter o Verify Token protegido: a tela explicará que ele deve ser obtido com o administrador responsável pela configuração do TechERP, sem revelar o segredo no navegador.
- Melhorar nomes, descrições e mensagens de erro do formulário para orientar a correção quando WABA ID ou token forem inválidos.
- Preservar conexão, sincronização de números e definição do número padrão já existentes.

### 4. Organização técnica
- Extrair o tutorial para um componente dedicado, mantendo a página de configuração enxuta e dentro do limite de tamanho do projeto.
- Atualizar os metadados próprios da rota com título e descrição da configuração do WhatsApp.
- Usar componentes e tokens visuais existentes, com funcionamento em tema claro/escuro e adaptação para celular, tablet e desktop.

## Validação
- Executar typecheck, lint e testes automatizados.
- Validar no navegador o guia, ampliação dos prints, links, cópia da URL e o formulário em desktop e celular.
- Confirmar que nenhum token, segredo ou dado real aparece nos prints, no código ou em mensagens da interface.

## Fora do escopo
- Alterar o envio ou recebimento de mensagens.
- Alterar banco, permissões ou a integração já implementada com a Meta.
- Configurar ou revelar segredos do servidor.
