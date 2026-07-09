/// <reference types="node" />
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
