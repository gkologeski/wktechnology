# Upload de assets de branding (logos, favicons e ilustrações)

Hoje o upload real só existe em parte da tela de branding: o painel principal e o editor de tema já usam o controle de imagem com upload para a biblioteca de mídia. O branding por módulo e o branding de e-mail de convite ainda pedem a URL digitada à mão, e as URLs geradas são assinadas com validade — sem renovação, um logo pode parar de carregar no futuro.

## O que muda

### 1. Upload em todos os campos de imagem do branding

- Branding por módulo: "Logotipo (URL)" e "Favicon (URL)" passam a usar o mesmo controle de imagem com abas Upload / URL / Biblioteca (arrastar-e-soltar, prévia, remover).
- Branding do e-mail de convite: o campo de logo também passa a aceitar upload.
- O editor de tema (logo claro, logo escuro, símbolo, arte de login, ilustração de estado vazio) continua como está, apenas com validações melhores.

### 2. Validação por tipo de campo

- Logos e ilustrações: PNG, JPG, WEBP, SVG, AVIF.
- Favicon: PNG, SVG e ICO.
- Limite por arquivo: 2 MB para logos/favicons, 5 MB para ilustrações e arte de login (mensagem clara ao exceder).
- Aviso (não bloqueante) quando a imagem tem proporção ruim para o uso: favicon não quadrado, símbolo reduzido muito largo.

### 3. Assets organizados e URLs que não expiram na prática

- Os arquivos de branding continuam no bucket de mídia já existente, isolados por workspace, agora sob um prefixo próprio de branding para ficarem identificáveis.
- Ao carregar o branding, URLs de assets do próprio bucket que estejam perto de vencer são renovadas automaticamente e regravadas — o mesmo comportamento que a biblioteca de mídia já aplica.

### 4. Herança visível no módulo

- Nos campos de imagem do módulo, quando não há upload próprio, o controle mostra a prévia herdada do workspace com a marcação "herdado" e um botão para voltar a herdar.

## Detalhes técnicos

- `src/components/ui/image-input.tsx`: novas props opcionais `maxBytes`, `allowedMimes` e `aspectHint` (validação client-side antes do upload, mensagens em pt-BR). Nenhuma quebra nos usos atuais — os valores padrão mantêm o comportamento vigente.
- `src/lib/media.functions.ts`: `createMediaUploadUrl` aceita um `folder` opcional validado por enum (`branding`), gerando caminho `"{workspace}/branding/{ano}/{mês}/{uuid}-{arquivo}"`. Mantém `requireSupabaseAuth`, o escopo por workspace ativo e a checagem de MIME já existentes.
- `src/lib/branding.functions.ts` e `src/lib/modules/module-branding.functions.ts`: no `getBranding`/`getModuleBranding`, renovar URLs assinadas do bucket de mídia quando faltar menos de 30 dias para expirar (usando `supabaseAdmin` apenas para assinar/atualizar). Sem mudança de schema, policies ou RLS.
- `src/components/branding/module-branding-form.tsx`: substituir os dois `Input` de URL por `ImageInput` (`folder="branding"`), mantendo o restante do formulário e o payload de salvamento intactos.
- `src/components/branding/invite-email-branding-form.tsx`: mesma substituição no campo de logo.
- `src/components/branding/theme-editor.tsx`: passar `maxBytes`/`allowedMimes`/`aspectHint` por campo e, quando `inherited` traz um valor, exibir prévia herdada + botão "voltar a herdar".
- Design system: uso de componentes oficiais (`Label`, `Button`, `Dialog`, `Tabs`), tokens semânticos, foco visível, estados de loading/erro via `sonner`, responsivo e validado em claro/escuro.
- Validações a rodar: typecheck, lint, build e os testes existentes afetados.

## Fora de escopo

- Não cria bucket público nem altera policies de storage.
- Não mexe em RLS, permissões, schema ou regras de negócio.
- Não redesenha telas fora de branding.
- Não adiciona corte/redimensionamento de imagem (pode ser um passo seguinte).
