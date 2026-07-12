# Especificação de Design: Motor de Sugestão Competitivo Completo e Sinergias (Equinox)

Esta especificação detalha as alterações arquiteturais necessárias para elevar o motor de sugestões do Equinox a um nível 100% competitivo, introduzindo suporte a conjuntos competitivos completos (Sets), atualizações automáticas via CDN/GitHub e um novo motor de análise de sinergias e inconsistências para times completos de 6 Pokémon.

---

## 🎯 Objetivos do Projeto

1. **Sets Competitivos Completos**: Associar conjuntos completos de batalha (Item, Habilidade, Natureza, EVs e 4 Movimentos) a cada espécie em seu formato respectivo (Vanilla e Radical Red).
2. **Atualização Automática de Dados**: Implementar sincronização incremental de conjuntos baseada em Data Packs JSON estáticos com validação e atualização remota automática (via CDN ou GitHub) contra buffs/nerfs de temporadas.
3. **Avaliação pelo Time Completo (6 Pokémon)**: Toda a tomada de decisão combinatória e scoring de sinergias passará a avaliar a composição completa de 6 membros de forma ativa.
4. **Motor de Sinergias e Inconsistências (Anti-sinergias)**: Detectar e pontuar sinergias (climas, arenas, Trick Room e momentum) e penalizar pesadamente inconsistências (conflito de climas, conflitos de velocidade e violação da Item Clause).

---

## 💾 Modelagem de Dados

### `src/models/PokemonSet.ts` [NEW]
Modelará os conjuntos competitivos de batalha vinculados a cada espécie e formato:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPokemonSet extends Document {
  pokemonName: string;      
  formatId: string;         
  setName: string;          
  item: string;             
  ability: string;          
  nature: string;           
  evs: {
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  };
  moves: string[];          
  role: string;             
  synergyTags: string[];    
}

const PokemonSetSchema = new Schema<IPokemonSet>({
  pokemonName: { type: String, required: true, index: true },
  formatId: { type: String, required: true, index: true },
  setName: { type: String, required: true },
  item: { type: String, required: true },
  ability: { type: String, required: true },
  nature: { type: String, required: true },
  evs: {
    hp: { type: Number, default: 0 },
    atk: { type: Number, default: 0 },
    def: { type: Number, default: 0 },
    spa: { type: Number, default: 0 },
    spd: { type: Number, default: 0 },
    spe: { type: Number, default: 0 }
  },
  moves: [{ type: String, required: true }],
  role: { type: String, required: true },
  synergyTags: [{ type: String }]
});

PokemonSetSchema.index({ pokemonName: 1, formatId: 1 });

export const PokemonSet = mongoose.model<IPokemonSet>('PokemonSet', PokemonSetSchema);
```

---

## 🌐 Sincronização e Carga de Dados (`DataSyncService`)

### `src/services/DataSyncService.ts` [NEW]
Gerenciará o ciclo de vida dos Data Packs:
1. **Seed Local**: Na inicialização do servidor, se a coleção `PokemonSet` estiver vazia, carrega e insere os dados de `src/equinox/data-packs/sets-data-pack.json`.
2. **Atualização Dinâmica**: Expõe um método `syncRemote()` que faz a checagem HTTP contra uma URL remota. Se a versão remota for mais recente que a versão no banco de dados, baixa a nova versão e sobrescreve de forma transacional e incremental a tabela `PokemonSet` por formato.

---

## ⚡ Motor de Sinergias e Inconsistências de Time (`SynergyEngine`)

### `src/equinox/engines/SynergyEngine.ts` [NEW]
Implementará as seguintes regras de avaliação para os 6 Pokémon da composição final:

1. **Weather Synergy & Clashes**:
   * *Regra de Sinergia*: Identifica geradores automáticos de climas (Drought, Drizzle, Sand Stream, Snow Warning) + abusadores correspondentes. Concede **+25 pontos**.
   * *Regra de Conflito*: Se o time possuir múltiplos geradores de climas concorrentes que se anulam (ex: Drought + Sand Stream), aplica uma penalidade de **-45 pontos** e adiciona uma explicação negativa detalhada.
2. **Terrain Synergy & Clashes**:
   * *Regra de Sinergia*: Gerador de campo (ex: Psychic Surge) + abusadores correspondentes (Expanding Force, etc.). Concede **+20 pontos**.
   * *Regra de Conflito*: Invocadores concorrentes de campos diferentes. Aplica penalidade de **-35 pontos**.
3. **Trick Room vs Speed**:
   * *Regra de Sinergia*: Presença do golpe *Trick Room* no time + pelo menos 2 aliados com base Speed $\le 55$. Concede **+20 pontos**.
   * *Regra de Conflito*: Invocador de *Trick Room* coexistindo com 2 ou mais sweepers rápidos ($\ge 100$ Spe). Aplica penalidade de **-30 pontos**.
4. **Volt-Turn Momentum**:
   * Detecta se o time possui 2 ou mais usuários de movimentos de transição (U-turn, Volt Switch, Flip Turn, Parting Shot). Concede bônus de **+15 pontos**.
5. **Item Clause**:
   * Verifica se há itens repetidos entre os 6 membros para formatos de campeonato oficiais (como Champions VGC). Aplica **-50 pontos** se houver duplicatas.

---

## ⚙️ Alterações nos Componentes Existentes

### `src/equinox/recommendation/CombinationSearchEngine.ts` [MODIFY]
* O buscador de trios passará a iterar sobre as combinações de **Sets específicos** dos candidatos válidos (lidos da coleção `PokemonSet`).
* O pipeline de 15 motores executará a avaliação das combinações considerando os atributos dinâmicos do set (habilidade ativa, item, naturezas e movimentos de fato) para o time completo de 6 Pokémon.

### `src/services/TeamService.ts` [MODIFY]
* Ao receber os 3 Pokémon do usuário, carrega seus sets compatíveis da coleção `PokemonSet`. Se o usuário não informar sets específicos, cria um set fallback a partir dos status da tipagem (usando `generateBasicKit`).
* Repassa as informações dinâmicas do set de cada Pokémon ao `CombinationSearchEngine`.

---

## 🧪 Plano de Verificação

### Testes Automatizados
* Criar e executar um script de auditoria e validação de contratos `src/scripts/validateSynergyEngine.ts` que simula:
  * Uma equipe com Charizard (Drought) + Tyranitar (Sand Stream) para validar a aplicação da penalidade de clima conflitante (-45).
  * Uma equipe com Pelipper (Drizzle) + Kingdra (Swift Swim) para validar o bônus (+25).
  * Uma equipe violando a Item Clause (dois Focus Sash) no formato Champions para verificar a penalidade (-50).
* Rodar o comando `npm run preflight` garantindo sucesso total nas validações.
