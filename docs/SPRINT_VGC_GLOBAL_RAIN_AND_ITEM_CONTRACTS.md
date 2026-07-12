# Sprint VGC Global Rain and Item Contracts

## Objetivo
Corrigir falhas sistêmicas observadas em cores de Rain sem criar exceções para um time específico.

## Problemas tratados
- O motor reconhecia Rain, mas ainda priorizava fillers genéricos em vez de peças que sustentam o contrato de chuva.
- Abilities passivas de chuva, como Rain Dish/Hydration/Dry Skin, podiam ser interpretadas como abuser primário de Rain, quando o contrato competitivo deve priorizar Swift Swim ou perfis explicitamente primários.
- Sets gerados automaticamente podiam violar Item Clause quando dois membros base recebiam o mesmo item padrão.
- Fallbacks de weather abuser usavam Chlorophyll como padrão para qualquer clima, o que é incorreto para Rain, Sand e Snow.

## Solução sistêmica
- Separação entre weather abuser primário e weather support/passive compatibility.
- Contrato de Rain Offense exige setter de chuva e redundância mínima de abusers primários para manter modos de 4 consistentes.
- Candidate scoring passou a reforçar abusers de Rain quando o core já possui setter de chuva.
- Combination search aplica normalização global de Item Clause antes de validar e analisar times completos.
- Set optimizer agora possui fallback de weather por família: Sun/Chlorophyll, Rain/Swift Swim, Sand/Sand Rush, Snow/Slush Rush.
- Curadoria adicionada para perfis gerais de Rain sem depender de combinações fixas.

## Regra de arquitetura
A correção não deve favorecer Politoed, Blastoise ou Swampert individualmente. A regra é:

1. Detectar o arquétipo.
2. Aplicar o contrato de clima correspondente.
3. Exigir que o abuser primário realmente abuse daquele clima.
4. Validar Item Clause no time completo.
5. Só então permitir diversidade de categoria.
