# Sprint 18.3 — Data Source Freshness Layer

## Objetivo

Adicionar uma camada explícita de confiabilidade das fontes usadas pelo Equinox.

A partir desta sprint, uma recomendação deixa de mostrar apenas o resultado competitivo e passa também a declarar quais dados sustentaram aquela decisão: formato, pool Vanilla, pacote Radical Red, regulação Pokémon Champions, roster elegível e meta database.

## Por que isso importa

O Equinox agora suporta formatos com naturezas muito diferentes:

- Vanilla: depende do jogo escolhido e do pool disponível naquela versão.
- Radical Red: depende do Drive oficial, data pack e changelog da ROM hack.
- Pokémon Champions: depende de Regulation Set, temporada e roster elegível.
- Competitivo/meta ladder: depende da lista curada de ameaças e do metagame.

Sem essa camada, o usuário poderia receber uma recomendação correta tecnicamente, mas sem saber se ela está baseada em dados verificados, comunitários, bootstrap ou pendentes.

## Arquivos adicionados

```txt
src/equinox/data/DataSourceReport.ts
src/equinox/engines/DataSourceEngine.ts
frontend/src/components/analysis/DataSourcePanel.tsx
```

## Arquivos alterados

```txt
src/equinox/core/AnalysisContext.ts
src/services/TeamService.ts
src/equinox/recommendation/RecommendationAdapter.ts
frontend/src/types/equinox.ts
frontend/src/components/analysis/index.ts
frontend/src/App.tsx
frontend/src/i18n/equinoxI18n.ts
frontend/src/index.css
```

## O que o DataSourceEngine faz

- Consolida fontes usadas na recomendação.
- Classifica status como `verified`, `community`, `bootstrap`, `pending`, `outdated` ou `unknown`.
- Gera uma confiança agregada dos dados.
- Expõe warnings críticos quando o formato depende de dados pendentes.
- Gera checklist de atualização por tipo de formato.

## UI

Foi adicionada uma nova seção em **Detalhes sob demanda**:

```txt
Fontes e atualização dos dados
```

Ela mostra:

- status geral das fontes;
- confiança dos dados;
- cards por fonte usada;
- escopo, versão e origem;
- avisos e política de atualização;
- checklist de manutenção.

## Próximo passo recomendado

Depois desta sprint, o Equinox está mais transparente para formatos vivos. O próximo passo natural é preparar o fechamento de release ou criar importadores de data pack para Radical Red/Champions se quisermos automatizar atualização de fontes.
