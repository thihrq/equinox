# Sprint 18.5 — Pokémon Champions Meta Source Pack

## Objetivo

Transformar Pokémon Champions de um perfil apenas `regulation-aware` em um perfil também `source-aware`.

A Sprint 18.2 já separou Champions de Vanilla e criou perfis para Regulation Set M-B Singles/Doubles. A Sprint 18.5 adiciona uma camada explícita de fontes, deixando claro de onde vêm as regras, o contexto de temporada, os arquétipos e os pesos usados pela recomendação.

## Fontes usadas

### Fonte oficial — Pokémon Champions gameplay/news

Usada para:

- modos Ranked, Casual e Private;
- Single Battle e Double Battle;
- Mega Evolution em Ranked Battles;
- temporadas e Regulation Sets;
- mudança de elegibilidade e parâmetros entre regulações.

### Fonte competitiva complementar — Victory Road Regulations

Usada para:

- janela da Regulation Set M-B;
- contexto VGC/tournament-facing;
- referência de ruleset, team rules e links para allowed roster / allowed Mega Evolutions;
- sinalização de que roster completo ainda deve virar data pack estruturado.

### Fonte competitiva complementar — Victory Road Replica Teams

Usada apenas como prior comunitário/tournament-derived para Doubles:

- arquétipos de Fake Out + Tailwind;
- Sun/Mega pressure;
- Trick Room balance;
- Balance pivot cores;
- Pokémon recorrentes nos exemplos iniciais de Champions, como Incineroar, Charizard, Sneasler, Garchomp, Kingambit, Farigiraf, Milotic, Rotom-Wash e Aegislash.

## O que não foi feito ainda

Esta sprint não importa automaticamente:

- roster completo permitido M-B;
- lista completa de Mega Evolutions permitidas;
- usage oficial de ladder;
- estatísticas reais de pick/win rate;
- results parser automático.

Esses pontos continuam separados para uma sprint futura de `Champions Roster Import` ou `Champions Usage Import`.

## Arquivos principais

```txt
src/equinox/champions/ChampionsMetaSourcePack.ts
src/equinox/champions/ChampionsRegulationProfile.ts
src/equinox/champions/ChampionsRegulationData.ts
src/equinox/champions/ChampionsRegulationScorer.ts
src/equinox/engines/DataSourceEngine.ts
src/equinox/data-packs/DataPackRegistry.ts
frontend/src/components/analysis/ChampionsRegulationPanel.tsx
frontend/src/types/equinox.ts
frontend/src/i18n/equinoxI18n.ts
frontend/src/index.css
```

## Mudança de comportamento

O ChampionsRegulationScorer agora considera:

- ameaças prioritárias vindas do source pack;
- arquétipos por batalha Singles/Doubles;
- confiança da fonte;
- correspondência de candidatos com arquétipos conhecidos;
- distinção entre fonte oficial, derivada de torneio, comunidade e bootstrap.

## Política de confiança

- Regras oficiais têm prioridade máxima.
- Victory Road Regulations entra como referência competitiva complementar.
- Victory Road Replica Teams entra como prior comunitário/tournament-derived, não como usage oficial.
- O bootstrap Singles continua explícito e com menor confiança.
- Recomendações Champions continuam marcadas como não totalmente roster-locked até que o roster permitido seja importado como data pack.

## Resultado esperado na UI

Em Detalhes sob demanda → Pokémon Champions Regulation, o usuário passa a ver:

- pacote de fontes usado;
- confiança da fonte;
- fontes usadas;
- arquétipos usados;
- avisos de que o source pack não é usage oficial final.
