# Sprint 18.4 — Data Pack Import Toolkit

Esta sprint cria a camada operacional para governar os dados versionados do Equinox antes do release.

## Por que existe

Depois da Format Intelligence Layer, Radical Red, Pokémon Champions e Vanilla passaram a depender de fontes de dados diferentes:

- Radical Red usa boss gauntlet do Hardcore / Restricted Mode.
- Pokémon Champions usa Regulation Profiles e ainda precisa de roster elegível por temporada.
- Vanilla usa pools bootstrap por jogo oficial até termos data packs de encontros por versão.

Sem uma camada de manifesto/validação, o projeto poderia voltar a misturar dados vivos com heurísticas genéricas sem visibilidade clara.

## O que foi adicionado

- `DataPackManifest.ts` com contrato padronizado para data packs.
- `DataPackRegistry.ts` agregando data packs Radical Red, Champions e Vanilla.
- `DataPackValidator.ts` validando manifestos e o pacote de bosses do Radical Red.
- Script `npm run data:check`.
- Endpoint `GET /api/system/data-packs`.
- Alias `GET /system/data-packs`.

## Como testar

```bash
npm run data:check
```

Também é possível acessar:

```txt
GET http://localhost:3000/api/system/data-packs
```

## Como interpretar

- `verified`: fonte forte e pronta para scoring.
- `community`: fonte útil, mas ainda precisa de revisão periódica.
- `bootstrap`: heurística conservadora até existir import real.
- `pending`: planejado, mas ainda não deve ser tratado como dado fechado.
- `outdated`: precisa ser bloqueado ou atualizado antes de release.

## Próximos passos possíveis

- Importador JSON/CSV/Sheets para Radical Red.
- Importador de roster elegível do Pokémon Champions por Regulation Set.
- Data packs Vanilla por versão, rota, troca, pós-game e disponibilidade real.
