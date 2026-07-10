# Sprint — VGC Plan Refinement

## Objetivo
Refinar a camada de decisão VGC após teste real com Sun/Tailwind, corrigindo casos em que o motor classificava o próprio setter de sol como abuser dedicado e aceitava times com redundância estratégica.

## Diagnóstico do teste

O resultado ficou legalmente muito melhor, mas ainda mostrou três pontos de ajuste:

1. Charizard-Mega-Y com `Solar Beam` estava sendo classificado como `Weather Abuser`, mesmo sendo o `Weather Setter` principal.
2. O time aceitava Sun sem um abuser dedicado como `Chlorophyll`, reduzindo a chance de recomendar Venusaur.
3. O pipeline ainda avaliava combinações demais para Pokémon Champions Doubles, mantendo latência alta.

## Ajustes aplicados

- `VgcTeamBuilding.ts`
  - Separação entre **Weather Setter** e **Weather Abuser dedicado**.
  - Charizard-Mega-Y com `Solar Beam` não conta mais como abuser dedicado de sol.
  - Times com `Drought/Sunny Day` sem `Chlorophyll/Solar Power/Protosynthesis` agora recebem alerta de lacuna.
  - `Venusaur`/abusers reais de sol recebem bônus extra quando o time já possui setter de sol.
  - Penalidade para redundância de `Tailwind` quando o segundo usuário não resolve outra lacuna relevante.
  - Penalidade leve para dois `Intimidate` sem redirection ou cleaner claro.
  - Modos de 4 em Sun Offense são melhor pontuados quando preservam `setter de sol + abuser dedicado`.
  - Dois setters do **mesmo clima** não são mais tratados automaticamente como conflito; `Charizard-Mega-Y + Sunny Day Whimsicott` é aceito como redundância positiva de guerra de clima.

- `CandidateScoreEngine.ts`
  - Penalidade para candidatos Mega quando o time base já possui uma opção Mega.
  - Evita que Megas inválidos apareçam no topo do ranking de candidatos antes da combinação final.

- `CombinationSearchEngine.ts`
  - Ranking final agora considera `vgcTeamPlan` antes do score específico de Champions Regulation.
  - Bloqueio de conflito entre `Electric Surge` e planos baseados em `Sleep Powder`/`Spore`.

- `FormatPerformanceProfile.ts`
  - Redução do orçamento de pipeline para Pokémon Champions Doubles.
  - Novo perfil prioriza pré-ranking VGC e executa pipeline completo apenas nas melhores combinações.

## Validação rápida de plano

- Time sem abuser dedicado de sol:
  - Detecta `Weather Abuser` como função crítica ausente.
  - Gera alerta: `Plano de sol sem abuser dedicado; o clima fica subaproveitado.`

- Time com Venusaur:
  - Remove lacuna de `Weather Abuser`.
  - Eleva o score de plano VGC nos testes locais de 78 para 94.

## Validação técnica

- Backend build: OK
- Frontend typecheck: OK
- Frontend build: OK
