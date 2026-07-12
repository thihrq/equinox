# Sprint VGC — Archetype Compatibility Guardrails

## Objetivo

Transformar correções pontuais em validações sistêmicas por arquétipo. O Equinox não deve aceitar um Pokémon apenas porque ele pontua bem individualmente: o set, a velocidade, a função e a mecânica precisam sustentar o contrato do arquétipo detectado.

## Problema observado

O core `Farigiraf + Mawile-Mega + Torkoal` passou a ser reconhecido como `Trick Room Sun`, porém ainda havia sintomas gerais:

- abusers rápidos de sol podiam entrar em Trick Room Sun como se fossem equivalentes a abusers lentos;
- Pokémon marcados como setters de Trick Room podiam sair sem `Trick Room` quando caíam no fallback genérico;
- sets genéricos com `Hyper Voice` ou `Double-Edge` sem STAB/ability podiam passar por recomendação;
- categorias finais podiam escolher opções que pontuavam bem, mas disputavam o contrato mecânico.

## Solução sistêmica

### 1. `evaluateVgcArchetypeCompatibility`

Novo guardrail central em `VgcArchetypeBlueprints.ts`.

Ele avalia qualquer time completo contra o arquétipo detectado e retorna:

- `score`: ajuste positivo/negativo por compatibilidade;
- `warnings`: problemas mecânicos corrigíveis;
- `hardFailures`: falhas que invalidam o contrato do arquétipo.

### 2. Validações gerais adicionadas

Para arquétipos de Trick Room:

- exige setter confiável de Trick Room;
- exige proteção para colocar Trick Room;
- valoriza abusers lentos;
- penaliza atacantes rápidos sem função de suporte;
- penaliza abusers rápidos de clima dentro de Trick Room Sun quando eles criam um modo oposto ao plano principal.

Para qualidade de set:

- setter de Trick Room precisa ter `Trick Room` no set;
- redirection precisa ter `Follow Me`, `Rage Powder` ou `Ally Switch`;
- setter de sol precisa ativar sol por habilidade ou golpe;
- `Hyper Voice` e `Double-Edge` sem STAB/ability de conversão são tratados como indício de fallback genérico.

### 3. Fallback de set por mecânica

`VgcSetOptimizer` agora sintetiza sets funcionais quando existe perfil mecânico, mas não existe preset curado específico.

Exemplos:

- Pokémon marcado como `trick_room:setter` recebe um set base com `Trick Room`;
- Pokémon marcado como `trick_room:abuser` recebe natureza lenta e golpes STAB conforme tendência física/especial;
- Pokémon marcado como `weather:abuser` recebe um kit ofensivo com STAB + `Protect`;
- Pokémon marcado como `redirection:support` recebe set de suporte com redirection.

## Integração

A compatibilidade sistêmica agora afeta:

- score de candidatos;
- score de combinações;
- validade da combinação final;
- seleção das categorias Recomendado/Ofensivo/Defensivo/Anti-meta/Criativo;
- painel de contrato mecânico no plano VGC.

## Princípio

Toda correção nova deve entrar como uma regra geral de contrato, compatibilidade ou qualidade de set. Ajustes por espécie devem ser usados apenas como perfis mecânicos, não como exceções escondidas no fluxo de recomendação.
