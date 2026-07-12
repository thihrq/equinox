# Sprint VGC — Archetype Slot Integrity

## Objetivo

Fortalecer o motor de sinergia para que as opções finais não sejam escolhidas apenas por score bruto ou novidade. Cada slot sugerido precisa sustentar o arquétipo detectado, a categoria exibida e o set provável.

## Problema observado

Após os contratos mecânicos, o Equinox passou a preservar melhor o esqueleto de Trick Room Sun, mas ainda podia escolher fillers genéricos em categorias como Ofensivo, Defensivo, Anti-meta e Criativo. O problema não era uma espécie específica; era a ausência de uma validação geral entre:

- arquétipo detectado;
- função real do novo slot;
- qualidade do set;
- categoria da recomendação;
- compatibilidade de velocidade.

## Solução sistêmica

1. Em arquétipos Trick Room, habilidades que dobram Speed no clima agora são tratadas como conflito de contrato quando a velocidade efetiva fica alta demais.
2. Trick Room Sun exige abuser de sol que continue compatível com baixa velocidade, e não apenas qualquer Chlorophyll/Swift Swim/Sand Rush/Slush Rush.
3. Abuser de sol precisa ter habilidade, golpe ou tag que sustente a função após a habilidade legal ser resolvida.
4. Sets genéricos VGC sintetizados priorizam Protect antes de cobertura extra quando o item permite.
5. Habilidades funcionais como Harvest, Solar Power, Sand Rush e Slush Rush entraram na prioridade do resolvedor de habilidade.
6. As categorias finais passaram a avaliar a contribuição nova da opção:
   - Ofensivo precisa trazer pressão ofensiva real compatível com o arquétipo.
   - Defensivo precisa trazer suporte, bulk, pivot, redirection ou controle de turno.
   - Anti-meta precisa trazer uma resposta mecânica real.
   - Criativo pode variar, mas não pode quebrar o contrato ou vir de fallback ruim.
7. O painel VGC no frontend agora usa chaves estáveis mesmo quando leads/modos repetem os mesmos nomes.

## Resultado esperado

Para cores de Trick Room Sun, o motor deve manter peças como setter, abuser lento, redirection/proteção e suporte. Opções rápidas baseadas em habilidade de velocidade climática só devem ser aceitas quando o arquétipo detectado também comportar um modo rápido explícito.
