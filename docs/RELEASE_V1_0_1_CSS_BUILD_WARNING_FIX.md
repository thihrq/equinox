# Release Equinox v1.0.1 — CSS Build Warning Fix

## Objetivo

Remover o warning gerado pelo Vite durante o build de produção causado por um seletor CSS inválido na regra de redução de movimento.

## Correção

O bloco de `frontend/src/styles/animations.css` foi separado em duas regras válidas:

- `.eq-reduce-motion *` para o modo manual de redução de movimento;
- `@media (prefers-reduced-motion: reduce)` para respeitar a preferência do sistema operacional.

## Impacto

- Nenhuma mudança visual esperada.
- Nenhuma mudança na lógica de recomendação.
- Mantém acessibilidade para usuários com preferência de movimento reduzido.
- Remove o warning `Invalid empty selector` no build de produção.

## Validação recomendada

```powershell
npm run release:check
```

O build deve finalizar sem warning de CSS.
