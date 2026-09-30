# Por que a Priscila não consegue criar empresas

## Causa (confirmada no banco)
- A Priscila (priscila.nascimento@wktechnology.com.br) está ativa no workspace, com o cargo **Head de RH**.
- O cargo Head de RH só pode **ver** empresas. Ele não tem a permissão "Criar empresas", e o workspace não tem nenhum ajuste que a libere para esse cargo.
- Quando ela clica em "Criar", o sistema bloqueia de propósito. O que está errado é o aviso: ele aparece em inglês ("new row violates row-level security policy…"), em vez de explicar o que houve.
- Outros cargos também não podem criar empresas: Financeiro, Auditor, Apontador de Horas, Recrutador e Gerente Técnico.

## O que fazer
1. **Liberar a Priscila:** você mesmo fará a liberação na tela de permissões, sem código. Fica fora deste plano.
2. **Aviso claro (código):** a janela "Criar empresa" e os outros lugares que criam empresa vão mostrar "Seu cargo não tem permissão para criar empresas. Peça a um administrador." Para isso, vou usar o tratamento de erro de permissão que o sistema já tem.
3. **Evitar a tentativa (código):** quem não tem a permissão vai ver o botão "Criar empresa" desabilitado, com essa mesma explicação ao passar o mouse.

## Detalhes técnicos
- Política `ws_insert_companies`: exige `techsales.companies.manage.workspace` ou `techsales.companies.create.own` com `owner_id = auth.uid()`. As duas deram falso para ela em `user_has_permission`.
- A política e o banco não mudam. Na interface, o erro RLS (42501) do insert em `quick-create-dialogs.tsx` e em `companies.tsx` passa por `handle-permission-error.ts`. O botão fica desabilitado conforme `current_user_permissions()`.
- Validação: entrar no navegador como a Priscila (com a sua aprovação), confirmar o aviso em português e o botão desabilitado; depois de liberar a permissão, confirmar que ela consegue criar a empresa.
