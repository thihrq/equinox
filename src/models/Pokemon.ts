import mongoose, { Schema, Document } from 'mongoose';

export interface IPokemonVariant {
  formatId: string;
  regulationId?: string;
  formId?: string;
  types: string[];
  abilities: {
    0: string;
    1?: string;
    H?: string;
    primary?: string;
    secondary?: string;
    hidden?: string;
    transformed?: string;
  };
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  weight?: number;
  legalMoves?: string[];
  availability?: {
    legal: boolean;
    reason?: string;
  };
  tier?: string;
}

export interface IPokemon extends Document {
  dexNumber: number;
  name: string;
  baseForme?: string;
  isLegendary: boolean; // <-- INJETAMOS APENAS ISTO AQUI
  variants: IPokemonVariant[];
}

const VariantSchema = new Schema<IPokemonVariant>({
  formatId: { type: String, required: true },
  regulationId: { type: String },
  formId: { type: String, index: true },
  types: [{ type: String, required: true }],
  abilities: {
    0: { type: String, required: true },
    1: { type: String },
    H: { type: String },
    primary: { type: String },
    secondary: { type: String },
    hidden: { type: String },
    transformed: { type: String }
  },
  baseStats: {
    hp: { type: Number, required: true },
    atk: { type: Number, required: true },
    def: { type: Number, required: true },
    spa: { type: Number, required: true },
    spd: { type: Number, required: true },
    spe: { type: Number, required: true }
  },
  weight: { type: Number },
  legalMoves: [{ type: String }],
  availability: {
    legal: { type: Boolean, default: true },
    reason: { type: String }
  },
  tier: { type: String }
}, { _id: false }); 

const PokemonSchema = new Schema<IPokemon>({
  dexNumber: { type: Number, required: true, index: true },
  name: { type: String, required: true, index: true },
  baseForme: { type: String },
  isLegendary: { type: Boolean, default: false }, // <-- E ISTO AQUI
  variants: [VariantSchema]
}, { 
  timestamps: true 
});

PokemonSchema.index({ name: 1, 'variants.formatId': 1 });
PokemonSchema.index({ name: 1, 'variants.formId': 1, 'variants.regulationId': 1 });

export const Pokemon = mongoose.model<IPokemon>('Pokemon', PokemonSchema);
