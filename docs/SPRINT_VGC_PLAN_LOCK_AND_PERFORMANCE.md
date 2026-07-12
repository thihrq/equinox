# Sprint — VGC Plan Lock and Performance Refinement

## Objetivo
Refinar a recomendação VGC para impedir que o pipeline troque a identidade do time por peças fortes isoladas, especialmente em Sun Offense iniciado por Drought/Sunny Day.

## Ajustes aplicados

- Separação entre abuser primário de sol e abuser apenas compatível com sol.
  - Primário: Chlorophyll, Solar Power, Flower Gift, Harvest, Weather Ball, Solar Blade.
  - Compatível: Protosynthesis.
- Sun Offense iniciado pelo usuário agora exige pelo menos um abuser primário de sol quando o base team ainda não possui essa função.
- Flutter Mane/Protosynthesis continua sendo positivo, mas não substitui Venusaur/Chlorophyll como peça central do plano de sol.
- Penalidade adicional para:
  - Sun sem abuser primário.
  - Duas peças com fraqueza 4x a Rock.
  - Sun com três Fire-types sem redirection.
- O comparador final agora prioriza times com menos funções críticas VGC ausentes antes de comparar score bruto.
- O orçamento do pipeline completo em Pokémon Champions Doubles foi reduzido de 96 para 24 avaliações.

## Resultado esperado

Para bases como Charizard-Mega-Y + Whimsicott + Garchomp, o motor deve preferir completar o plano com Venusaur/Chlorophyll antes de considerar atacantes apenas compatíveis com sol, como Flutter Mane.

Também deve evitar composições como Charizard-Mega-Y + Incineroar + Volcarona sem redirection, por redundância de Fire e fraqueza coletiva a Rock Slide.
