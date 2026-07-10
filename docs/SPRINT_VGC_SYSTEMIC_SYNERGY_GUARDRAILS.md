# Sprint VGC Systemic Synergy Guardrails

## Objetivo

Fortalecer o motor de sinergia do Equinox com regras gerais de qualidade competitiva, evitando correções pontuais para uma combinação específica.

Esta sprint transforma problemas como sets genéricos, preenchimento de slot sem função real e conflitos entre arquétipo/velocidade/moveset em validações reutilizáveis para qualquer arquétipo VGC.

## Problema observado

Após a implantação de contratos por arquétipo, o motor já preservava melhor o esqueleto do plano, mas ainda aceitava algumas peças que entravam por score bruto sem sustentar função competitiva clara. Exemplos de sintomas:

- Pokémon classificado como peça ofensiva com golpes desalinhados com seus atributos.
- Pokémon marcado como suporte mecânico sem o golpe que sustenta essa função.
- Atacante rápido ou filler genérico entrando em arquétipo Trick Room sem oferecer suporte, prioridade, redirection, proteção ou abuser lento.
- Categorias de resposta selecionando variações por novidade/score bruto, e não por qualidade do slot.

## Solução sistêmica

### 1. Qualidade de set como contrato geral

Foi criada uma validação reutilizável de qualidade de set em `VgcArchetypeBlueprints`:

- setter de Trick Room precisa ter `Trick Room`;
- redirection precisa ter `Follow Me`, `Rage Powder` ou `Ally Switch`;
- setter de clima precisa realmente ativar o clima;
- peça ofensiva precisa ter dano confiável compatível com tipo, ability ou atributo dominante;
- golpes genéricos como `Double-Edge`, `Hyper Voice` e `Tera Blast` sem STAB/ability de conversão são tratados como sinal de fallback ruim;
- arquétipos Trick Room penalizam atacantes rápidos sem função mecânica de suporte.

### 2. Fallback de set por função, não por template genérico

`VgcSetOptimizer` agora sintetiza sets genéricos melhores quando não existe preset curado:

- usa STAB físico ou especial conforme maior atributo ofensivo;
- adiciona cobertura padrão coerente;
- completa quatro golpes;
- escolhe natureza lenta para Pokémon naturalmente lentos;
- evita preservar sets claramente genéricos ou desalinhados.

### 3. Score de candidatos passa a considerar set provável

`CandidateScoreEngine` agora otimiza o set provável do candidato antes de aplicar qualidade VGC. Isso reduz a chance de um candidato subir apenas por status base, tipo ou BST sem ter moveset coerente com sua função.

### 4. Seleção das categorias usa qualidade sistêmica

`RecommendationAdapter` agora incorpora qualidade de set na seleção das opções:

- hard failures de set reduzem fortemente a chance da combinação virar opção;
- warnings de set reduzem score;
- opção criativa só recebe bônus real quando a variação continua mecanicamente válida.

## Resultado esperado

A ferramenta passa a rejeitar ou rebaixar sistemicamente:

- filler sem contribuição para o arquétipo;
- moveset incompatível com a função atribuída;
- atacante rápido em Trick Room sem suporte/prioridade/turn control;
- dano desalinhado com tipo ou atributo dominante;
- redirection falso;
- setter falso de campo/clima/Trick Room.

O objetivo não é bloquear criatividade, mas impedir que criatividade entre como sinônimo de incoerência competitiva.

## Validação local

Foi executada checagem sintática dos arquivos alterados via TypeScript `transpileModule`.

O `tsc --noEmit` completo não pôde ser concluído neste sandbox porque o pacote extraído não contém `node_modules`, gerando erros de dependências ausentes como `express`, `mongoose`, `@pkmn/dex` e `@types/node`.
