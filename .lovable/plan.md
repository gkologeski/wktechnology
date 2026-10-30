# Corrigir importação CSV do Apollo (erro "at most 2000 characters")

Porte P — cerca de 30 a 45 minutos.

## Causa (confirmada no código e no arquivo)
A importação envia ao servidor todas as colunas de cada linha, inclusive as que não foram mapeadas. O servidor recusa qualquer célula com mais de 2.000 caracteres. No arquivo do Apollo (735 contatos), as colunas "Keywords" e "Technologies" passam desse limite em várias linhas, então a importação inteira é recusada, mesmo que essas colunas nem sejam usadas.

## Correção
1. Na tela de importação, enviar ao servidor só as colunas que foram mapeadas para algum campo. Colunas ignoradas não saem do navegador.
2. No servidor, quando um campo mapeado tiver texto longo, cortar em 2.000 caracteres e avisar no resultado (por exemplo, "Keywords cortado em 12 linhas"), em vez de recusar o arquivo todo. O limite contra arquivos abusivos (linhas, colunas, tamanho total) continua igual.
3. Mostrar erros de validação em português, dizendo linha e coluna, em vez do texto técnico.

## Validação
- Teste novo: linha com coluna não mapeada de 5.000 caracteres é aceita; campo mapeado longo é cortado e avisado.
- Importar o seu arquivo do Apollo no navegador como leads/contatos, sem gravar duplicados (a conferência por e-mail e telefone continua).
- Registrar a mudança no controle de permissões (mesma permissão de importação já existente, sem chave nova).

## Detalhes técnicos
- `src/lib/csv-import.functions.ts`: `rowSchema` com `z.string().max(2000)`; passar a filtrar `row` pelas chaves de `mapping` no cliente e aplicar truncamento + aviso no `buildRecord` para valores mapeados.
- Componente da tela de importação que chama a server function: montar `rows` só com `Object.keys(mapping)`.
