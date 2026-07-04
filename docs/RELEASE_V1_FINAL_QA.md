# Release Equinox v1.0 — Final QA & Launch Polish

## Objetivo

Fechar a versão 1.0 com versão final, checks de saúde mais claros, mensagens de erro seguras, documentação operacional e comandos de validação consistentes.

## O que foi polido

- Versão final `1.0.0` no backend, frontend e exemplos de ambiente.
- Endpoint `/api/system/release` com visão consolidada de MongoDB, data packs, auditoria de formato e Smart Cache.
- `/ready` agora considera falhas bloqueantes de data packs e format scope, não apenas MongoDB.
- Erros de rota, CORS, JSON inválido e falhas internas passam a ter códigos padronizados.
- Frontend agora diferencia falha de rede, rota não encontrada e CORS com mensagens amigáveis.
- Mensagem de erro da sidebar recebeu `role="alert"` e microinteração respeitando `prefers-reduced-motion`.
- README raiz criado com execução, variáveis e comandos de release.
- `release:check` centraliza typecheck, data check, format check e build frontend.

## Comandos finais

```bash
npm run typecheck
npm run data:check
npm run format:check
npm run release:check
```

## Endpoints finais

```txt
GET /health
GET /ready
GET /api/system/status
GET /api/system/data-packs
GET /api/system/format-scope
GET /api/system/release
POST /api/team/suggest
```

## Critérios de aceite

- Backend TypeScript passa.
- Frontend TypeScript passa.
- `data:check` não possui falhas bloqueantes.
- `format:check` não possui falhas bloqueantes.
- Warnings esperadas continuam transparentes na UI.
- Sugestão de equipe funciona para Vanilla, Radical Red, Champions e Competitivo.
- Smart Cache retorna `HIT` para requisições idênticas.
- Nenhum stack trace técnico é exposto em produção.
