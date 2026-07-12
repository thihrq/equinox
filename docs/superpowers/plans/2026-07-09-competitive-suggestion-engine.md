# Competitive Suggestion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o suporte a conjuntos competitivos completos (Sets), atualizações automáticas via CDN/GitHub e um novo motor de análise de sinergias e inconsistências para times completos de 6 Pokémon.

**Architecture:** Criar a coleção `PokemonSet` no MongoDB, implementar o serviço `DataSyncService` para seed local e checagem remota, e introduzir a engine de análise `SynergyEngine` no pipeline executando sobre os 6 membros da equipe.

**Tech Stack:** TypeScript, Node.js, Mongoose, @pkmn/dex, Axios, ts-node.

## Global Constraints
- Todo o código e documentação devem respeitar o idioma Português do Brasil (PT-BR).
- Não utilizar placeholders ou TBD.
- Rodar o validador `npm run preflight` no fim de cada commit para garantir consistência.

---

### Task 1: Criar o Schema e Modelo `PokemonSet`

**Files:**
- Create: `src/models/PokemonSet.ts`
- Create: `src/scripts/validateSynergyEngine.ts`

**Interfaces:**
- Produces: Modelo Mongoose `PokemonSet` e interface `IPokemonSet`.

- [ ] **Step 1: Escrever o teste de integridade do modelo**

Criar o arquivo de teste `src/scripts/validateSynergyEngine.ts` para conectar ao banco e tentar instanciar um `PokemonSet`:

```typescript
// src/scripts/validateSynergyEngine.ts
import mongoose from 'mongoose';
import { PokemonSet } from '../models/PokemonSet';
import 'dotenv/config';

async function testModel() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon-builder';
  await mongoose.connect(MONGO_URI);
  console.log('📦 Conectado ao MongoDB para testes de modelo.');

  await PokemonSet.deleteMany({ pokemonName: 'Charizard-Test' });

  const testSet = new PokemonSet({
    pokemonName: 'Charizard-Test',
    formatId: 'radical_red',
    setName: 'Test Set',
    item: 'Charizardite Y',
    ability: 'Drought',
    nature: 'Timid',
    evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    moves: ['Flamethrower', 'Solar Beam', 'Focus Blast', 'Roost'],
    role: 'Wallbreaker',
    synergyTags: ['sun_setter', 'sun_abuser']
  });

  await testSet.save();
  const retrieved = await PokemonSet.findOne({ pokemonName: 'Charizard-Test' });
  if (!retrieved || retrieved.setName !== 'Test Set') {
    throw new Error('Falha ao salvar ou recuperar PokemonSet');
  }

  await PokemonSet.deleteMany({ pokemonName: 'Charizard-Test' });
  console.log('✅ Teste do modelo PokemonSet concluído com sucesso!');
  process.exit(0);
}

testModel().catch(err => {
  console.error('❌ Erro no teste do modelo:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o teste para verificar a falha**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: FAIL com erro `Cannot find module '../models/PokemonSet'` ou similar.

- [ ] **Step 3: Criar o arquivo `PokemonSet.ts`**

Escrever o modelo em `src/models/PokemonSet.ts`:

```typescript
// src/models/PokemonSet.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPokemonSet extends Document {
  pokemonName: string;      
  formatId: string;         
  setName: string;          
  item: string;             
  ability: string;          
  nature: string;           
  evs: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
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

- [ ] **Step 4: Rodar o teste para verificar se passa**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: PASS com mensagem `✅ Teste do modelo PokemonSet concluído com sucesso!`

- [ ] **Step 5: Commit**

```bash
git add src/models/PokemonSet.ts src/scripts/validateSynergyEngine.ts
git commit -m "feat: adicionar modelo PokemonSet do MongoDB e validador"
```

---

### Task 2: Implementar o `DataSyncService` e Carregar o Data Pack Local

**Files:**
- Create: `src/services/DataSyncService.ts`
- Create: `src/equinox/data-packs/sets-data-pack.json`
- Modify: `src/scripts/validateSynergyEngine.ts` (estender para testar sincronização)

**Interfaces:**
- Produces: `DataSyncService.bootstrap()`, `DataSyncService.syncRemote()`.

- [ ] **Step 1: Escrever teste de sincronização no script**

Modificar `src/scripts/validateSynergyEngine.ts` para testar o carregamento local:

```typescript
// src/scripts/validateSynergyEngine.ts
import mongoose from 'mongoose';
import { PokemonSet } from '../models/PokemonSet';
import { DataSyncService } from '../services/DataSyncService';
import 'dotenv/config';

async function testSync() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon-builder';
  await mongoose.connect(MONGO_URI);
  console.log('📦 Conectado ao MongoDB para testes de sincronização.');

  await PokemonSet.deleteMany({});
  
  await DataSyncService.bootstrap();
  
  const count = await PokemonSet.countDocuments({});
  if (count === 0) {
    throw new Error('Falha no seed local dos conjuntos competetivos.');
  }

  console.log(`✅ Sincronização carregou ${count} conjuntos com sucesso!`);
  process.exit(0);
}

testSync().catch(err => {
  console.error('❌ Erro no teste de sincronização:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar teste para verificar falha**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: FAIL por falta do módulo `DataSyncService`.

- [ ] **Step 3: Criar o Data Pack JSON e o Serviço**

Criar o arquivo JSON de data-pack padrão em `src/equinox/data-packs/sets-data-pack.json`:

```json
{
  "version": "2026.07.09.01",
  "formatsSupported": ["vanilla_scarlet_violet", "radical_red"],
  "sets": [
    {
      "pokemonName": "Meganium",
      "formatId": "radical_red",
      "setName": "RR Triage Bulky Sweeper",
      "item": "Leftovers",
      "ability": "Triage",
      "nature": "Bold",
      "evs": { "hp": 252, "def": 252, "spd": 4 },
      "moves": ["Giga Drain", "Draining Kiss", "Synthesis", "Calm Mind"],
      "role": "Pivot",
      "synergyTags": ["triage_user", "bulky_setup"]
    },
    {
      "pokemonName": "Charizard",
      "formatId": "radical_red",
      "setName": "Mega Charizard Y Attacker",
      "item": "Charizardite Y",
      "ability": "Drought",
      "nature": "Timid",
      "evs": { "spa": 252, "spd": 4, "spe": 252 },
      "moves": ["Flamethrower", "Solar Beam", "Focus Blast", "Roost"],
      "role": "Wallbreaker",
      "synergyTags": ["sun_setter", "sun_abuser", "special_attacker"]
    },
    {
      "pokemonName": "Torkoal",
      "formatId": "radical_red",
      "setName": "Sun Pivot Setter",
      "item": "Heat Rock",
      "ability": "Drought",
      "nature": "Relaxed",
      "evs": { "hp": 252, "def": 252, "spd": 4 },
      "moves": ["Stealth Rock", "Rapid Spin", "Yawn", "Lava Plume"],
      "role": "Hazard Setter",
      "synergyTags": ["sun_setter", "pivot"]
    },
    {
      "pokemonName": "Venusaur",
      "formatId": "radical_red",
      "setName": "Chlorophyll Special Sweeper",
      "item": "Life Orb",
      "ability": "Chlorophyll",
      "nature": "Modest",
      "evs": { "spa": 252, "spd": 4, "spe": 252 },
      "moves": ["Growth", "Giga Drain", "Weather Ball", "Sludge Bomb"],
      "role": "Wallbreaker",
      "synergyTags": ["sun_abuser", "special_attacker"]
    },
    {
      "pokemonName": "Tyranitar",
      "formatId": "radical_red",
      "setName": "Sand Stream Bulky Attacker",
      "item": "Chople Berry",
      "ability": "Sand Stream",
      "nature": "Adamant",
      "evs": { "hp": 252, "atk": 252, "spd": 4 },
      "moves": ["Stone Edge", "Knock Off", "Earthquake", "Stealth Rock"],
      "role": "Hazard Setter",
      "synergyTags": ["sand_setter", "physical_attacker"]
    },
    {
      "pokemonName": "Pelipper",
      "formatId": "radical_red",
      "setName": "Drizzle Pivot Rain Setter",
      "item": "Damp Rock",
      "ability": "Drizzle",
      "nature": "Relaxed",
      "evs": { "hp": 252, "def": 252, "spd": 4 },
      "moves": ["Scald", "U-turn", "Hurricane", "Roost"],
      "role": "Pivot",
      "synergyTags": ["rain_setter", "pivot"]
    },
    {
      "pokemonName": "Kingdra",
      "formatId": "radical_red",
      "setName": "Swift Swim Special Sweeper",
      "item": "Choice Specs",
      "ability": "Swift Swim",
      "nature": "Modest",
      "evs": { "spa": 252, "spd": 4, "spe": 252 },
      "moves": ["Hydro Pump", "Draco Meteor", "Surf", "Ice Beam"],
      "role": "Wallbreaker",
      "synergyTags": ["rain_abuser", "special_attacker"]
    }
  ]
}
```

Criar o arquivo `src/services/DataSyncService.ts`:

```typescript
// src/services/DataSyncService.ts
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PokemonSet } from '../models/PokemonSet';

export class DataSyncService {
  private static readonly LOCAL_PACK_PATH = path.join(__dirname, '../equinox/data-packs/sets-data-pack.json');
  private static readonly REMOTE_URL = 'https://raw.githubusercontent.com/obra/superpowers/main/sets-data-pack.json';

  public static async bootstrap(): Promise<void> {
    const localData = JSON.parse(fs.readFileSync(this.LOCAL_PACK_PATH, 'utf8'));
    const bulkOperations = localData.sets.map((set: any) => ({
      updateOne: {
        filter: { pokemonName: set.pokemonName, formatId: set.formatId, setName: set.setName },
        update: { $set: set },
        upsert: true
      }
    }));

    if (bulkOperations.length > 0) {
      await PokemonSet.bulkWrite(bulkOperations);
      console.log(`[Equinox DataSync] Bootstrap carregou ${bulkOperations.length} conjuntos competitivos.`);
    }
  }

  public static async syncRemote(): Promise<void> {
    try {
      const response = await axios.get(this.REMOTE_URL);
      const remoteData = response.data;

      if (!remoteData || !Array.isArray(remoteData.sets)) {
        throw new Error('Formato do arquivo remoto inválido.');
      }

      const bulkOperations = remoteData.sets.map((set: any) => ({
        updateOne: {
          filter: { pokemonName: set.pokemonName, formatId: set.formatId, setName: set.setName },
          update: { $set: set },
          upsert: true
        }
      }));

      if (bulkOperations.length > 0) {
        await PokemonSet.bulkWrite(bulkOperations);
        console.log(`[Equinox DataSync] Sincronização remota atualizou ${bulkOperations.length} conjuntos.`);
      }
    } catch (err: any) {
      console.warn(`[Equinox DataSync] Falha na checagem remota, usando cache local. Erro: ${err.message}`);
    }
  }
}
```

- [ ] **Step 4: Rodar teste para verificar se passa**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: PASS com mensagem `✅ Sincronização carregou 7 conjuntos com sucesso!`

- [ ] **Step 5: Commit**

```bash
git add src/services/DataSyncService.ts src/equinox/data-packs/sets-data-pack.json src/scripts/validateSynergyEngine.ts
git commit -m "feat: adicionar DataSyncService e sets-data-pack.json"
```

---

### Task 3: Implementar o `SynergyEngine` no Pipeline de Análise

**Files:**
- Create: `src/equinox/engines/SynergyEngine.ts`
- Modify: `src/scripts/validateSynergyEngine.ts` (estender para validar regras de sinergia/choque)

**Interfaces:**
- Consumes: Habilidades, Movimentos, Itens dos Sets dos 6 Pokémon do `AnalysisContext`.
- Produces: Pontuações e avisos estruturados gravados em `context.analysis` e `context.score`.

- [ ] **Step 1: Escrever testes para sinergias e conflitos climáticos**

Modificar `src/scripts/validateSynergyEngine.ts` para injetar times mockados e testar as penalidades e bônus:

```typescript
// src/scripts/validateSynergyEngine.ts
import mongoose from 'mongoose';
import { AnalysisContext, PokemonData } from '../equinox/core/AnalysisContext';
import { SynergyEngine } from '../equinox/engines/SynergyEngine';

async function testSynergies() {
  const engine = new SynergyEngine();

  // Teste 1: Chuva Sinergética (Pelipper + Kingdra)
  const rainTeam: PokemonData[] = [
    { name: 'Pelipper', types: ['Water', 'Flying'], abilities: { 0: 'Keen Eye', H: 'Drizzle' } },
    { name: 'Kingdra', types: ['Water', 'Dragon'], abilities: { 0: 'Swift Swim' } },
    { name: 'Meganium', types: ['Grass'] }
  ];
  const context1 = new AnalysisContext({ format: 'radical_red', selectedPokemon: rainTeam });
  // Mock dos sets
  context1.explanations = [];
  
  // Vamos rodar a engine
  engine.execute(context1);

  if (context1.score.total !== 25) {
    throw new Error(`Sinergia de chuva falhou. Esperado 25, obtido ${context1.score.total}`);
  }

  // Teste 2: Conflito de clima (Charizard/Drought + Tyranitar/Sand Stream)
  const clashTeam: PokemonData[] = [
    { name: 'Charizard', types: ['Fire', 'Flying'], abilities: { 0: 'Blaze', H: 'Solar Power' } },
    { name: 'Torkoal', types: ['Fire'], abilities: { 0: 'Drought' } },
    { name: 'Tyranitar', types: ['Rock', 'Dark'], abilities: { 0: 'Sand Stream' } }
  ];
  const context2 = new AnalysisContext({ format: 'radical_red', selectedPokemon: clashTeam });
  engine.execute(context2);

  if (context2.score.total !== -45) {
    throw new Error(`Conflito de climas falhou. Esperado -45, obtido ${context2.score.total}`);
  }

  console.log('✅ Todos os testes de sinergia e anti-sinergia passaram!');
  process.exit(0);
}

testSynergies().catch(err => {
  console.error('❌ Erro no teste de sinergia:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o teste para verificar a falha**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: FAIL com erro de arquivo `SynergyEngine` não encontrado.

- [ ] **Step 3: Implementar a classe `SynergyEngine.ts`**

Escrever `src/equinox/engines/SynergyEngine.ts`:

```typescript
// src/equinox/engines/SynergyEngine.ts
import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';

export class SynergyEngine implements AnalysisEngine {
  public readonly name = 'SynergyEngine';

  public execute(context: AnalysisContext): void {
    const team = context.selectedPokemon;
    let score = 0;

    // 1. Climas
    const weatherSetters = new Set<string>();
    const weatherAbusers = new Set<string>();

    for (const pokemon of team) {
      const ability = pokemon.abilities?.[0] || pokemon.abilities?.['H'] || '';
      
      // Detecção de geradores
      if (/drizzle/i.test(ability)) weatherSetters.add('rain');
      if (/drought/i.test(ability)) weatherSetters.add('sun');
      if (/sand stream/i.test(ability)) weatherSetters.add('sand');
      if (/snow warning/i.test(ability)) weatherSetters.add('snow');

      // Detecção de abusadores
      if (/swift swim/i.test(ability)) weatherAbusers.add('rain');
      if (/chlorophyll|solar power/i.test(ability)) weatherAbusers.add('sun');
      if (/sand rush|sand force/i.test(ability)) weatherAbusers.add('sand');
      if (/slush rush/i.test(ability)) weatherAbusers.add('snow');
    }

    if (weatherSetters.size > 1) {
      score -= 45;
      context.addExplanation({
        engine: this.name,
        reason: 'Conflito de Clima: O time possui múltiplos geradores de clima que se anulam mutuamente.',
        value: -45,
        impact: 'negative'
      });
    } else if (weatherSetters.size === 1) {
      const activeWeather = [...weatherSetters][0];
      if (weatherAbusers.has(activeWeather)) {
        score += 25;
        context.addExplanation({
          engine: this.name,
          reason: `Núcleo de Clima ativo: Excelente sinergia ao redor de ${activeWeather.toUpperCase()}.`,
          value: 25,
          impact: 'positive'
        });
      }
    }

    context.score.total = (context.score.total || 0) + score;
  }
}
```

- [ ] **Step 4: Rodar o teste para verificar se passa**

Run: `npx ts-node src/scripts/validateSynergyEngine.ts`
Expected: PASS com mensagem `✅ Todos os testes de sinergia e anti-sinergia passaram!`

- [ ] **Step 5: Commit**

```bash
git add src/equinox/engines/SynergyEngine.ts src/scripts/validateSynergyEngine.ts
git commit -m "feat: implementar SynergyEngine e validador de núcleos climáticos"
```

---

### Task 4: Integrar Sinergias e Sets no Buscador Combinatório (`CombinationSearchEngine`)

**Files:**
- Modify: `src/equinox/recommendation/CombinationSearchEngine.ts`
- Modify: `src/services/TeamService.ts`

- [ ] **Step 1: Rodar os testes de preflight para confirmar estabilidade atual**

Run: `npm run preflight`
Expected: PASS

- [ ] **Step 2: Ajustar a busca combinatória**

Modificar `src/services/TeamService.ts` e `src/equinox/recommendation/CombinationSearchEngine.ts` para carregar conjuntos do MongoDB (`PokemonSet`) e passá-los ao pipeline de análise sobre o time de 6 membros.

Adicionar `SynergyEngine` na lista de plugins do pipeline no `TeamService.ts`:
```typescript
// src/services/TeamService.ts
import { SynergyEngine } from '../equinox/engines/SynergyEngine';
// ...
    const pipeline = new AnalysisPipeline()
      .use(new DefensiveMatrixEngine())
      .use(new WeaknessScoreEngine())
      .use(new RoleEngine())
      .use(new SpeedEngine())
      .use(new OffensiveCoverageEngine())
      .use(new FormatIntelligenceEngine())
      .use(new RadicalRedBossGauntletEngine())
      .use(new ChampionsRegulationEngine())
      .use(new MetaEngine())
      .use(new DataSourceEngine())
      .use(new ThreatEngine())
      .use(new DamageEngine())
      .use(new SynergyEngine()) // <-- ADICIONADO AQUI
      .use(new CoachEngine())
      .use(new AIBuilderEngine())
      .use(new FinalScoreEngine());
```

- [ ] **Step 3: Executar a validação completa**

Run: `npm run preflight`
Expected: PASS com todas as checagens normais de contrato.

- [ ] **Step 4: Commit final**

```bash
git add src/services/TeamService.ts src/equinox/recommendation/CombinationSearchEngine.ts
git commit -m "feat: integrar SynergyEngine ao pipeline global do Equinox"
```
