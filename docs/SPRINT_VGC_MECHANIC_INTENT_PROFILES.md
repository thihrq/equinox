# Sprint — VGC Mechanic Intent Profiles

## Problema corrigido

Quando o usuário informava apenas nomes de Pokémon, o Equinox dependia de sets genéricos ou do banco local para inferir papéis. Isso fazia Pokémon como Farigiraf serem tratados como atacantes/suportes genéricos, em vez de setter provável de Trick Room.

Exemplo que motivou o patch:

- Farigiraf deveria abrir plano de Trick Room.
- Mawile-Mega deveria ser reconhecido como atacante lento para Trick Room.
- Torkoal deveria ser reconhecido como Drought + atacante lento de Eruption, não como hazard/removal de singles.

## Solução

Foi adicionada uma camada de intenção VGC provável para Pokémon conhecidos por setar ou habilitar mecânicas de campo:

- Trick Room setters prováveis: Farigiraf, Cresselia, Porygon2, Dusclops, Hatterene, Indeedee-F, Armarouge, Oranguru, Mimikyu, Bronzong, Gothitelle etc.
- Trick Room abusers prováveis: Torkoal, Mawile-Mega, Ursaluna, Iron Hands, Camerupt-Mega, Rhyperior, Glastrier, Kingambit, Amoonguss etc.
- Redirection/support prováveis: Indeedee-F, Amoonguss, Maushold, Clefairy, Togekiss etc.

## Ajustes técnicos

### VgcSetOptimizer

Adicionados presets VGC para:

- Farigiraf
- Mawile-Mega / Mawile
- Torkoal
- Indeedee-F / Indeedee
- Amoonguss
- Porygon2
- Cresselia
- Ursaluna
- Ursaluna-Bloodmoon
- Iron Hands

Também foi refinada a prioridade de habilidades funcionais, incluindo:

- Armor Tail
- Psychic Surge
- Grassy Surge
- Electric Surge
- Misty Surge
- Drought
- Drizzle
- Sand Stream
- Snow Warning
- Regenerator
- Guts

### VgcTeamBuilding

Adicionadas funções:

- `isLikelyTrickRoomSetterForVgc`
- `isLikelyTrickRoomAbuserForVgc`
- `hasLikelyTrickRoomCoreForVgc`

A inferência de arquétipo agora prioriza Hard Trick Room quando o time base tem setter provável + atacante lento. Isso impede que Torkoal force Sun Offense quando o core real é Trick Room.

### CombinationSearchEngine

A trava de Sun Offense agora não se aplica quando o time base tem core provável de Trick Room. Isso evita que Torkoal + Farigiraf obrigue Venusaur por engano.

## Resultado esperado

Entrada:

```txt
Farigiraf
Mawile-Mega
Torkoal
```

Deve gerar base aproximada:

```txt
Farigiraf @ Safety Goggles
Ability: Armor Tail
- Trick Room
- Psychic
- Hyper Voice
- Protect

Mawile-Mega @ Mawilite
Ability: Intimidate
- Play Rough
- Iron Head
- Sucker Punch
- Protect

Torkoal @ Charcoal
Ability: Drought
- Eruption
- Heat Wave
- Earth Power
- Protect
```

E o plano deve ser detectado como:

```txt
Hard Trick Room
```

Com prioridade para complementos como:

- Amoonguss
- Indeedee-F
- Porygon2/Cresselia como segundo setter
- Ursaluna/Iron Hands como abusers lentos
