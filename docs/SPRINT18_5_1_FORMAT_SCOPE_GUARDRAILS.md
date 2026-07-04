# Sprint 18.5.1 — Format Scope Guardrails

## Objetivo

Corrigir inconsistências onde a Inteligência de Ameaças e a Análise de Matchups ainda podiam herdar ameaças de um perfil competitivo genérico, mesmo quando o usuário selecionava um jogo Vanilla específico.

## Problema observado

Ao selecionar Pokémon FireRed / LeafGreen, a tela podia exibir ameaças modernas como Kingambit, Great Tusk, Dragapult, Gholdengo, Iron Valiant e Walking Wake. Isso era conceitualmente incorreto, porque esses Pokémon não pertencem ao escopo do jogo selecionado.

## Correção

A camada de meta/threat agora respeita o escopo do formato antes de alimentar:

- MetaEngine;
- ThreatEngine;
- DamageEngine / Matchup Analysis;
- painéis de Inteligência de Ameaças;
- painéis de Análise de Matchups.

## Regras aplicadas

### Vanilla oficial

Cada jogo Vanilla recebe um perfil de ameaças do próprio pool do jogo, por exemplo:

- FireRed / LeafGreen: Dragonite, Snorlax, Lapras, Alakazam, Gengar, Starmie, Gyarados etc.;
- Emerald: Salamence, Metagross, Milotic, Swampert, Gardevoir, Flygon etc.;
- Platinum: Garchomp, Lucario, Togekiss, Infernape, Gengar, Tyranitar etc.

Esses perfis ainda são bootstrap conservadores por pool/dex. Data packs por rota, versão, pós-game e disponibilidade exata continuam como melhoria futura.

### Radical Red

Radical Red continua usando o perfil Hardcore / Restricted Boss Gauntlet e ameaças de boss. Não deve cair no meta genérico.

### Pokémon Champions

Pokémon Champions Singles/Doubles passam a expor ameaças do Regulation Profile / Champions Meta Source Pack, em vez de reaproveitar a lista genérica de singles.

### Competitivo / National Dex

Formatos competitivos continuam usando ameaça de ladder/meta.

## Arquivos alterados

- `src/equinox/meta/MetaDatabase.ts`
- `src/equinox/meta/MetaEngine.ts`
- `src/equinox/formats/FormatIntelligenceRegistry.ts`

## Validação esperada

Ao selecionar FireRed / LeafGreen, a UI não deve mostrar ameaças de gerações modernas em Inteligência de Ameaças ou Análise de Matchups.

Ao selecionar Pokémon Champions, as ameaças exibidas devem refletir o Regulation Profile ativo.

Ao selecionar Radical Red, as ameaças devem continuar relacionadas ao Hardcore Boss Gauntlet.
