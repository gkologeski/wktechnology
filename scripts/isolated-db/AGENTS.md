# Harness isolado

- Validação isolada usa esta pasta (estrutura extraída do catálogo real, nunca reaplicando o histórico de migrations, que não é reproduzível); `run.sh` sai 3 quando algo não foi executado e isso nunca conta como verde; por quê: provar RLS com as políticas reais sem tocar o banco compartilhado.
