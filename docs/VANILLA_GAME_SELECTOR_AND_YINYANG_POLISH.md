# Sprint 18.1.5 — Vanilla Game Selector + Yin Yang Polish

## Objetivo

Reduzir complexidade visual da sidebar e corrigir dois pontos de produto antes de seguir com os data packs finais:

- Vanilla deixa de ser entendido como um formato único executável.
- O usuário escolhe primeiro a família Vanilla e depois o jogo oficial desejado em um seletor compacto.
- Todos os símbolos Yin Yang visíveis passam a usar a mesma base visual do símbolo superior da sidebar.

## Vanilla como família

A sidebar mantém quatro famílias principais:

- Vanilla
- Competitivo
- Radical Red
- Pokémon Champions

Quando Vanilla está ativo, a seleção do jogo passa para um `<select>` agrupado por região/era. Isso evita criar dezenas de botões na sidebar e reduz carga cognitiva.

## Jogos Vanilla adicionados

Perfis adicionados em `VanillaGameProfiles.ts`:

- Pokémon Red / Blue / Yellow
- Pokémon FireRed / LeafGreen
- Pokémon Gold / Silver / Crystal
- Pokémon HeartGold / SoulSilver
- Pokémon Ruby / Sapphire
- Pokémon Emerald
- Pokémon Omega Ruby / Alpha Sapphire
- Pokémon Diamond / Pearl
- Pokémon Platinum
- Pokémon Brilliant Diamond / Shining Pearl
- Pokémon Black / White
- Pokémon Black 2 / White 2
- Pokémon X / Y
- Pokémon Legends: Z-A
- Pokémon Sun / Moon
- Pokémon Ultra Sun / Ultra Moon
- Pokémon Let’s Go Pikachu / Eevee
- Pokémon Sword / Shield
- Pokémon Legends: Arceus
- Pokémon Scarlet / Violet

## Escopo dos pools

Os pools ainda são bootstrap conservadores. Eles restringem por número de National Dex/ranges amplos por geração/jogo, mas não substituem data packs completos de encontros por versão, rota, troca, pós-game, DLC, transferências ou restrições narrativas.

Perfis como Legends: Z-A continuam como pendentes quando o Equinox ainda não possui um data pack verificado.

## Yin Yang

Foi criado um componente visual único `YinYangMark`, usado em:

- logo superior da sidebar;
- símbolo inferior da sidebar;
- estado vazio central.

Os Yin Yang de background em cards continuam como background decorativo com opacidade própria. Nenhum novo símbolo foi adicionado.
