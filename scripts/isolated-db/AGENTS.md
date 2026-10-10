# Harness isolado

- Validação isolada usa esta pasta (estrutura extraída do catálogo real, nunca reaplicando o histórico de migrations, que não é reproduzível); `run.sh` sai 3 quando algo não foi executado e isso nunca conta como verde; por quê: provar RLS com as políticas reais sem tocar o banco compartilhado.
- Integridade multiworkspace fica em `workspace-integrity.ts`: lacuna conhecida (`known_gap`) e não executado saem 3, nunca verde; por quê: risco documentado não pode passar como teste aprovado.
- `catalog-manifest.json` guarda só contagens e hashes do catálogo, atualizado com `ISO_WRITE_MANIFEST=1` depois de migração aprovada; por quê: detectar drift sem versionar dados ou corpos de função.
