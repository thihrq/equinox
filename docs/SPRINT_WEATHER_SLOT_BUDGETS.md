# Sprint — Weather Slot Budgets

## Problema

O `FormatPlanResolver` já conseguia detectar Rain e gerar Sableye como suporte manual de clima, mas o funil ainda permitia recomendações redundantes no time final:

- segundo setter automático de chuva quando o core já tinha `Drizzle`;
- excesso de abusers primários de clima;
- excesso de Water-types em Rain Doubles;
- item Choice em set com `Protect`.

Isso não era um problema de Politoed, Omastar ou de um time específico. Era ausência de orçamento de slots para arquétipos de clima.

## Solução sistêmica

### 1. Separação entre setter automático e setter manual

`FormatPlanResolver` agora diferencia:

- setter automático: `Drizzle`, `Drought`, `Sand Stream`, `Snow Warning` etc.;
- setter manual: `Rain Dance`, `Sunny Day`, `Sandstorm`, `Snowscape` ou suporte Prankster contextual.

### 2. Orçamento de slots para clima em Champions Doubles

Para times de clima em Champions Doubles:

- não adicionar outro setter automático quando o core já possui um;
- manter no máximo dois abusers primários, salvo quando o usuário já trouxe mais do que isso no core base;
- em Rain, limitar Water-types recomendados para evitar excesso de redundância ofensiva/defensiva;
- preservar suporte manual de clima como ferramenta válida sem tratar isso como setter automático redundante.

### 3. Sanitização global de item Choice

O `VgcSetOptimizer` agora corrige qualquer set VGC com:

- `Choice Specs` + `Protect`;
- `Choice Band` + `Protect`;
- `Choice Scarf` + `Protect`;
- `Assault Vest` + moves de status.

A correção troca o item por alternativas não-bloqueantes, respeitando o papel do Pokémon.

### 4. Preset de Omastar

Omastar recebeu preset VGC Rain coerente como abuser especial, sem `Choice Specs` preso a `Protect`.

## Resultado esperado

Para core como `Pelipper + Swampert-Mega + Sableye` em Champions Doubles:

- `Pelipper` permanece como setter automático de Rain;
- `Sableye` permanece como suporte manual de Rain/screens;
- `Swampert-Mega` permanece como abuser primário;
- o motor pode adicionar no máximo mais um abuser primário de Rain;
- o motor não deve adicionar `Politoed` como segundo setter automático;
- o time final deve evitar quatro ou mais Water-types;
- candidatos com `Choice item + Protect` devem ser normalizados antes da resposta final.
