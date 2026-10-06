# Corrigir erro ao criar empresa (representante externa)

## Diagnóstico (confirmado no banco)
- Eduarda (eduarda.astran@) tem o cargo "Representante de Vendas (externa)", com visibilidade restrita e sem ser admin.
- A empresa é gravada com ela como dona. Depois da gravação, o sistema relê o registro para abrir a ficha.
- A regra de leitura de empresas para representantes aceita só empresas de uma lista calculada pelo banco. Essa lista é montada **antes** da gravação, então a empresa nova ainda não está nela e a releitura é bloqueada. A empresa não é salva e aparece o erro.
- Contatos têm a mesma falha. Leads, Negócios, Tarefas e Cotações não têm: a regra deles confere direto se a pessoa é dona ou responsável.

## Correção
Ajustar a regra de leitura de **Empresas** e **Contatos** para também aceitar, conferindo direto no registro, quando a pessoa é dona ou responsável. É o mesmo formato já usado em Leads e Negócios.
- O que cada representante pode ver não muda: a lista calculada já incluía os registros dela como dona ou responsável.
- Outros cargos e administradores não são afetados.
- O formulário de criação não muda.

## Validação
- Criar uma empresa e um contato com uma sessão da Eduarda: os dois devem salvar e abrir a ficha.
- Conferir que a Eduarda continua sem ver empresas de outras carteiras.
- A mudança vale quando o rascunho for aceito.
