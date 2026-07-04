# Sprint 18.6 — Format Performance Guardrails

Esta sprint adiciona limites de performance por contexto de formato para impedir que formatos pesados, como Radical Red Hardcore e Pokémon Champions, executem o mesmo orçamento de busca de uma ladder genérica.

## Objetivo

Manter a qualidade das recomendações scenario-aware sem deixar o tempo de resposta escalar para dezenas de segundos quando o pipeline precisa avaliar gauntlet, regulation profile, data source freshness, damage lite, coach e AI Builder.

## Mudanças principais

- Novo `FormatPerformanceProfileRegistry`.
- Orçamento de `CombinationSearch` passa a depender do formato.
- Radical Red Hardcore usa orçamento menor e mais focado, porque o heurístico de gauntlet já é altamente específico.
- Pokémon Champions Singles/Doubles usa orçamento intermediário, preservando diversidade de archetypes.
- Ladders competitivas mantêm orçamento maior.
- Vanilla por jogo usa orçamento moderado, pois o pool é limitado pelo jogo selecionado.
- `CombinationSearchEngine` agora aceita `anchorCandidateLimit` e `perAnchorCombinations`.
- `RadicalRedGauntletScorer` ganhou cache interno para score de time e score de resposta contra ameaças de boss.

## Por que isso é seguro

O Radical Red não depende mais de varredura ampla para descobrir direção competitiva genérica. O score de gauntlet já mede pior boss, consistência, respostas críticas e ameaças de versão Hardcore. Portanto, faz sentido enviar menos trios para o pipeline completo e confiar mais no ranking heurístico especializado.

## Logs esperados

```txt
[Equinox] PerformanceGuardrail=Radical Red Gauntlet Performance Guardrail | maxPipeline=2200, keep=180, note=...
[Equinox] CombinationOptimizer: possible=..., valid=..., evaluated=2200, skippedInvalid=..., exploitation=0.9, anchors=18x10
[Equinox] RadicalRedScoreCache: teamScores=..., answerScores=...
```

## Próximo refinamento possível

Se Radical Red ainda ficar acima do esperado, o próximo passo é criar um pipeline de duas fases:

1. fase rápida de ranking com gauntlet/damage/meta mínimo;
2. fase completa somente nos melhores 300 trios.
