# Sprint 18.2 — Pokémon Champions Regulation Profiles

## Objetivo

Transformar Pokémon Champions em um formato realmente **regulation-aware**, em vez de tratar Singles/Doubles como variações Vanilla ou meta genérico.

## Fontes de referência

- Pokémon Champions — Gameplay oficial: confirma Ranked/Casual/Private Battles, Single Battle e Double Battle, uso de VP, Mega Evolution no primeiro ruleset, uso como software VGC a partir de 2026 e mudanças de regulações por temporada.
- Pokémon Champions — News oficial: lista Regulation Set M-B como temporada/ruleset atual de Ranked Battles e Battle Pass.
- Victory Road — Pokémon Champions Regulations: acompanha datas, formato de eventos, Regulation Set M-A/M-B, Double Battles competitivos, seleção de 4 entre 6 em Doubles e regras de equipe.

## Escopo implementado

### Backend

- `ChampionsRegulationProfile.ts`
- `ChampionsRegulationData.ts`
- `ChampionsRegulationScorer.ts`
- `ChampionsRegulationEngine.ts`

O perfil atual é:

```txt
Pokémon Champions Regulation Set M-B
Singles: champions_reg_m_b_singles
Doubles: champions_reg_m_b_doubles
Período: 2026-06-17 até 2026-09-02
Mega Evolution: habilitada
Status do roster: pending_full_import
```

### Engine

O novo scorer calcula:

```txt
- speed control
- role compression
- threat coverage
- field control
- Mega readiness
- consistency
- respostas contra ameaças-chave
```

Para Doubles, o peso de `fieldControl` é maior, considerando:

```txt
Fake Out
Intimidate
Redirection
Tailwind
Trick Room
Terrain
Weather
Spread pressure
Protect pressure
Lead pair stability
```

Para Singles, o peso é maior em:

```txt
speed control
priority
anti-setup
respostas diretas às ameaças rápidas
plano de Mega
cobertura Steel/Fairy/Ghost/Dark
```

### Integração com o pipeline

O pipeline agora roda:

```txt
FormatIntelligenceEngine
RadicalRedBossGauntletEngine
ChampionsRegulationEngine
MetaEngine
ThreatEngine
DamageEngine
CoachEngine
AIBuilderEngine
FinalScoreEngine
```

Quando o formato é Pokémon Champions, o `FinalScoreEngine` usa o objetivo de regulação em vez de ordenar apenas pelo score genérico.

### UI

Adicionado painel:

```txt
Pokémon Champions Regulation
```

Ele mostra:

```txt
- Regulation Set
- temporada
- datas
- battle style
- Mega Evolution
- score de ajuste à regulação
- controle de velocidade
- compressão de funções
- cobertura de ameaças
- controle de campo
- plano de Mega
- ameaças-chave e melhores respostas
- ações recomendadas
```

## Observação importante

Este patch cria a camada regulation-aware e um perfil M-B bootstrap. O full allowed-roster import ainda deve virar um data pack próprio, porque as listas oficiais podem mudar por temporada e devem ser atualizadas sem mexer no motor principal.
