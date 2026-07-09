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
