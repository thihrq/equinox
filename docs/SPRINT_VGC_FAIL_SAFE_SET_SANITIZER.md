# Sprint VGC Fail-Safe Set Sanitizer

## Objetivo

Corrigir uma falha sistêmica no fluxo de perfis mecânicos VGC: Pokémon que não possuem preset estático, mas possuem perfil mecânico, podiam acionar uma recursão entre o sintetizador de sets e o sanitizador de moves.

## Causa raiz

O fluxo anterior era:

1. `getCuratedVgcSet()` não encontrava preset estático.
2. O motor chamava `synthesizeMechanicFallbackSet()`.
3. O fallback chamava `sanitizeMoves()`.
4. `sanitizeMoves()` chamava `getCuratedVgcSet()` novamente.
5. O ciclo se repetia até `Maximum call stack size exceeded`.

Isso podia derrubar qualquer recomendação quando o candidate pool continha espécies com perfil mecânico, mas sem preset curado específico.

## Solução sistêmica

- `sanitizeMoves()` não chama mais `getCuratedVgcSet()`.
- O sanitizador agora só consulta presets estáticos e perfis preferenciais já resolvidos por `getStaticCuratedVgcSet()`.
- Fallbacks mecânicos usam `sanitizeMoves(..., { includeCuratedMoves: false })`, mantendo a síntese pura e sem recursão.
- `CandidateScoreEngine` agora é fail-safe por candidato: se um candidato malformado falhar, ele é ignorado sem derrubar toda a API.

## Resultado esperado

O Equinox deve voltar a responder normalmente em `/api/team/suggest`, mesmo quando o banco contém candidatos sem set curado completo.
