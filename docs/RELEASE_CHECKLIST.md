# Equinox v1.0 Final Release Checklist

## Backend

- [ ] `npm run typecheck` passa.
- [ ] `npm run data:check` passa sem falhas bloqueantes.
- [ ] `npm run format:check` passa sem falhas bloqueantes.
- [ ] `npm run build` gera `dist/` com sucesso.
- [ ] `npm start` inicializa a API compilada.
- [ ] `/health` retorna `200`.
- [ ] `/ready` retorna `200` quando MongoDB, data packs e format scope não possuem falhas bloqueantes.
- [ ] `/api/system/status` retorna MongoDB e Smart Cache.
- [ ] `/api/system/data-packs` retorna manifests e warnings esperados.
- [ ] `/api/system/format-scope` retorna auditoria por formato.
- [ ] `/api/system/release` retorna status consolidado da v1.0.
- [ ] `MONGO_URI` está configurado por variável de ambiente.
- [ ] `CORS_ORIGIN` está restrito em produção.
- [ ] Smart Cache registra `MISS`, `STORE` e `HIT` como esperado.

## Frontend

- [ ] `npm --prefix frontend run typecheck` passa.
- [ ] `npm --prefix frontend run build` passa.
- [ ] `VITE_API_BASE_URL` aponta para a API correta.
- [ ] PT-BR e EN-US permanecem utilizáveis.
- [ ] Dark e light mode permanecem legíveis.
- [ ] Estado vazio, loading, erro e sucesso estão compreensíveis.
- [ ] Sprites não quebram e fallback local continua funcionando.
- [ ] Mensagens de erro não expõem stack trace técnico.

## Product QA

- [ ] Gerar time Vanilla FireRed / LeafGreen e validar escopo Kanto.
- [ ] Gerar time Vanilla Emerald e validar escopo Gen I-III.
- [ ] Gerar time Radical Red e validar painel Hardcore Boss Gauntlet.
- [ ] Gerar time Pokémon Champions Singles e validar Regulation Profile.
- [ ] Gerar time Pokémon Champions Doubles e validar Regulation Profile.
- [ ] Gerar time Competitivo/National Dex e validar meta ladder.
- [ ] Validar identidades `balanced`, `hyper_offense` e `fun`.
- [ ] Repetir uma requisição idêntica e confirmar Smart Cache `HIT`.
- [ ] Validar Coach, Threat, Damage, AI Builder, Data Sources e Technical Details.

## Production Notes

- [ ] Não commitar `.env` real.
- [ ] Manter `.env.example` atualizado.
- [ ] Manter credenciais do MongoDB fora do repositório.
- [ ] Monitorar tempo da primeira geração e gerações em cache.
- [ ] Revalidar data packs vivos após updates de Radical Red, Pokémon Champions ou Legends Z-A.
