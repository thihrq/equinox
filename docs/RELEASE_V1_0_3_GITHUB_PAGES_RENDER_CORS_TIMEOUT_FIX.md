# Release v1.0.3 — GitHub Pages + Render CORS/Timeout Fix

## Objetivo

Corrigir o bloqueio de CORS observado no GitHub Pages e reduzir o risco de 502/timeouts no Render Free.

## Ajustes

- CORS customizado antes das rotas, respondendo `OPTIONS` diretamente com 204.
- Fallback de produção para `https://thiihrq.github.io`, mesmo quando variáveis do Render ainda não foram aplicadas.
- Padrão seguro para GitHub Pages via regex HTTPS.
- Headers CORS também em respostas de erro da API.
- Orçamentos `render_free` reduzidos de forma mais agressiva para evitar timeout em chamadas de recomendação.
- Versão atualizada para 1.0.3.

## Variáveis recomendadas no Render

```txt
NODE_ENV=production
APP_VERSION=1.0.3
CORS_ORIGIN=https://thiihrq.github.io
EQUINOX_RUNTIME_PROFILE=render_free
MONGO_URI=<sua_uri_do_mongo_atlas>
```

## Variável recomendada no frontend

```txt
VITE_API_BASE_URL=https://equinox-api-c7zy.onrender.com
```

## Validação

Após o deploy, teste no navegador e também:

```powershell
Invoke-RestMethod https://equinox-api-c7zy.onrender.com/health
Invoke-RestMethod https://equinox-api-c7zy.onrender.com/api/system/release
```
