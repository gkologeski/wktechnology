# Erro na nova solicitação de fornecedor (NEXID) — diagnóstico e correção

Porte: P · Estimativa: 15–25 min (só ajuste de cadastros, sem mudar o sistema)

## Diagnóstico (confirmado no banco, somente leitura)
Não é falha do sistema: a conferência está barrando divergências reais de cadastro.

1. **Entidade legal dos negócios** — os dois negócios (FS/NEXID/... Pacote 150h e CT/NEXID/... Complemento 111h) estão na entidade antiga **"WK Technology"**, que está **inativa** e sem CNPJ (cadastro antigo mantido só para histórico). A solicitação usa **GM Kologeski & Cia Ltda ME** (CNPJ 19.133.530/0001-36), ativa. Por isso aparecem os 4 avisos de "entidade inativa" e "mesma entidade legal".
2. **Projeto FABRICA_NEXID** — não tem negócio nem contrato comercial vinculados no cadastro. Por isso os 2 avisos de "projeto não vinculado".

## Correção proposta (pela interface, com sua sessão)
1. Em cada um dos dois negócios, trocar a entidade legal de "WK Technology" para "GM Kologeski & Cia Ltda ME".
2. No projeto FABRICA_NEXID, vincular o negócio principal (Pacote 150h) e o contrato comercial (Termo aditivo — Complemento de 111 horas).
   - Alternativa: remover o projeto da solicitação e vinculá-lo depois.
3. Voltar à solicitação, clicar "Atualizar conferência" e salvar o rascunho.
4. Validar com Playwright que os avisos sumiram (sem marcar como pronta/aprovar).

## Fora do escopo
- Nenhuma mudança de código, regra de conferência, permissão ou SQL.
- Não reativar a entidade "WK Technology" nem afrouxar a validação.

## Pendência a confirmar
- Se os negócios realmente pertencem à GM Kologeski (e não à CW/CMK). Se houver outros negócios na entidade antiga, tratar em lote separado.
