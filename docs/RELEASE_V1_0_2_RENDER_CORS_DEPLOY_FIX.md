# Release v1.0.2 — Render CORS Deploy Fix

Este hotfix corrige o comportamento observado em produção quando o frontend publicado no GitHub Pages tenta chamar a API no Render e recebe erro de CORS/502.

## O que mudou

- `CORS_ORIGIN` agora é normalizado como origin real do navegador.
- Variáveis alternativas também são aceitas: `CORS_ORIGINS`, `FRONTEND_URL`, `FRONTEND_ORIGIN` e `PUBLIC_FRONTEND_URL`.
- `CORS_ORIGIN_PATTERNS` foi adicionado para ambientes avançados.
- O servidor loga as origins liberadas na inicialização.
- O perfil `render_free` reduz o orçamento de CombinationSearch em produção para evitar timeouts/502 no Render Free.
- O frontend passa a reconhecer 502/503/504 como indisponibilidade/timeout de deploy.

## Configuração obrigatória no Render

No Render, em **Environment**, configure:

```txt
NODE_ENV=production
APP_VERSION=1.0.2
CORS_ORIGIN=https://thiihrq.github.io
EQUINOX_RUNTIME_PROFILE=render_free
MONGO_URI=<sua URI do Mongo Atlas>
```

Use exatamente o domínio que aparece no erro do navegador depois de `origin`. Normalmente é apenas:

```txt
https://SEU_USUARIO.github.io
```

Não use `/equinox` no `CORS_ORIGIN`, porque o header `Origin` do navegador não inclui o path do GitHub Pages.

## Configuração obrigatória no GitHub Pages

No build do frontend, `VITE_API_BASE_URL` deve apontar para a API do Render:

```txt
VITE_API_BASE_URL=https://equinox-api-c7zy.onrender.com
```

## Validação

Depois do deploy da API:

```powershell
Invoke-RestMethod https://equinox-api-c7zy.onrender.com/health
Invoke-RestMethod https://equinox-api-c7zy.onrender.com/api/system/release
```

Depois abra o GitHub Pages, limpe cache do navegador e gere uma equipe.
