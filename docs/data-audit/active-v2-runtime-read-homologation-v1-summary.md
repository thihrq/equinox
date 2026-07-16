# Active V2 Production Runtime Read Homologation V1 — Sumário da Fase 2

**Status:** Implementado e validado offline (27/27 testes agregados entre Fase 2/2A/4B/4/5). Preenche a lacuna que a própria Fase 2A já havia deixado registrada — esta fase é anterior a 2A na numeração original do Plano Mestre, mas só foi implementada agora.

## 1. Escopo desta fase

Objetivo do resumo do projeto: "Fazer o motor ler `pokemonsets_v2` em modo estritamente read-only, ainda fora do fluxo público", validando: uma versão ativa por `setId`, manifesto ativo, digest, schema, ausência de fallback, zero writes, zero leitura da coleção legada, e mesmo comportamento com a flag desligada.

| Componente | Arquivo |
|---|---|
| Leitor read-only | `src/services/competitive-data/runtime-read/ActiveV2RuntimeReader.ts` |
| Validador de homologação | `src/services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationValidator.ts` |
| Resolvedor de flag | `src/services/competitive-data/runtime-read/ActiveV2RuntimeReadFlagResolver.ts` |
| Formatter (JSON/Markdown) | `src/services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationFormatter.ts` |

## 2. Duas garantias por construção, não só por teste

- **Zero leitura da coleção legada:** `ActiveV2RuntimeReader.ts` importa os nomes de coleção de `ActiveV2ProductionPolicy.ts` (`pokemonsets_v2`, `publication_manifests`) e nunca referencia a string `pokemonsets` em nenhuma linha do arquivo. Isso significa que a garantia não depende de um branch condicional que poderia ter um bug — é estruturalmente impossível este código acessar a coleção legada. `validateActiveV2RuntimeReader.ts` ainda assim prova isso com um spy que falha se `pokemonsets` for solicitado.
- **Mesmo comportamento com a flag desligada:** `homologateActiveV2RuntimeRead()` verifica o modo **antes** de qualquer chamada ao Mongo. Quando `mode === 'baseline-only'`, a função retorna imediatamente sem sequer receber uma conexão válida — não é "lê e ignora o resultado", é "nunca tenta ler".

## 3. Reaproveitamento

A checagem de "uma versão ativa por setId / manifesto / digest" **não foi duplicada** — `ActiveV2RuntimeReadHomologationValidator.ts` chama diretamente `computeActiveV2RuntimeManifestHealth` (a mesma função da Fase 2A, já usada pelo circuit breaker na Fase 4B). Três fases, uma implementação.

O critério adicional específico da Fase 2 — "ausência de fallback" — é verificado comparando a lista `setIds` do manifesto ativo contra os `setId`s efetivamente lidos de `pokemonsets_v2`: qualquer `setId` presente no manifesto mas ausente na leitura vira um `INCOMPLETE_ACTIVE_SET`, o sintoma exato de um fallback silencioso.

## 4. Limitações assumidas

- **Nenhuma execução real contra Atlas.** Mesma limitação de todas as fases anteriores — validado com conexões Mongo mockadas.
- **Não substitui a Fase 3.** Este é o "motor consegue ler os dados corretamente", não "o motor está servindo tráfego real com esses dados" — isso continua sendo escopo da Fase 3 (Runtime Shadow Mode), ainda não implementada.

## 5. Suíte offline

`npm run sets:active-v2-runtime-read:offline:check` — 4 validadores (leitor, validador de homologação, resolvedor de flag, formatter). Combinado com as suítes anteriores: **27 testes offline**, todos passando, `npm run preflight` com exit 0.
