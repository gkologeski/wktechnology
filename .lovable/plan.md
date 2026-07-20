Plano para corrigir o erro de login com Google:

1. Confirmar o ponto exato do fluxo
   - Verificar se o erro ocorre no login principal (`/login`) ou ao conectar Gmail/Agenda nas configurações.
   - Validar a origem usada no momento do erro: `app.wktechnology.com.br`, `ats.wktechnology.com.br`, `crm.wktechnology.com.br` ou preview.

2. Revisar configuração do Google Auth no backend
   - Conferir se o provedor Google está habilitado no Lovable Cloud.
   - Reconfigurar o Social Auth do Google se a configuração estiver ausente, antiga ou inconsistente.
   - Garantir que os domínios customizados ativos estejam aceitos pelo fluxo gerenciado.

3. Revisar o código do login
   - Manter o uso correto de `lovable.auth.signInWithOAuth("google")`, não `supabase.auth.signInWithOAuth` direto.
   - Validar se `redirect_uri: window.location.origin` está adequado para todos os domínios publicados.
   - Ajustar o pós-login para preservar destino e redirecionar para `/dashboard` apenas depois da sessão estar hidratada, se necessário.

4. Diferenciar login Google de conexão Gmail/Agenda
   - Se o erro for no login social: corrigir o provedor Google Auth.
   - Se o erro for ao conectar Gmail/Agenda: revisar o OAuth Google usado pela integração de e-mail/calendário, que é outro fluxo e pode exigir redirect/client próprios.

5. Validar
   - Testar o botão “Entrar com Google” no preview/publicado conforme possível.
   - Verificar console/rede se o erro persistir.
   - Se a correção envolver configuração do backend, republicar o app para refletir o ajuste no domínio customizado.