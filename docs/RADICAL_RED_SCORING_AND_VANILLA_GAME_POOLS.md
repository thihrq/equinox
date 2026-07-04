# Sprint 18.1.3 — Radical Red Gauntlet Scoring + Vanilla Game Pools

## Por que este patch existe

A Sprint 18.1 criou o relatório de gauntlet para Radical Red, mas a seleção de combinações ainda podia parecer muito próxima do Vanilla porque a busca de trios era guiada principalmente por heurísticas genéricas antes do pipeline completo.

Este patch move Radical Red de uma leitura apenas explicativa para uma influência real na seleção.

## Radical Red Hardcore

Para `radical_red`, o Equinox agora aplica scoring de gauntlet em três pontos:

1. `CandidateScoreEngine`
   - cada candidato recebe bônus ou penalidade conforme melhora o pior matchup da gauntlet.
2. `CombinationSearchEngine`
   - o espaço de busca prioriza trios com melhor pior boss, consistência e menos ameaças críticas.
3. `FinalScoreEngine`
   - quando existe relatório Radical Red, o score final passa a ser orientado por boss gauntlet, não por meta genérico.

Critério principal:

```txt
pior boss > consistência > média da gauntlet > score genérico
```

Isso evita escolher um time que parece bom no meta, mas falha contra uma linha específica da Elite Four ou Champion.

## Vanilla por jogo

O formato `vanilla` genérico continua existindo, mas agora há perfis iniciais por jogo:

- `vanilla_fire_red`
  - pool conservador: Kanto Pokédex #001-151
- `vanilla_emerald`
  - pool conservador: Geração I-III #001-386
- `vanilla_legends_za`
  - placeholder, sem pool oficial carregado ainda

Esses perfis não substituem data packs completos de encontros/rotas. Eles resolvem o primeiro problema estrutural: impedir que um formato Vanilla de um jogo use livremente Pokémon fora do recorte esperado.

## Próximos upgrades recomendados

- Data pack oficial/importável do Radical Red Hardcore via Drive/Sheets.
- Data pack de pools Vanilla por jogo com disponibilidade real por versão, rota, pós-game e troca.
- Pokémon Champions Regulation Profiles.
