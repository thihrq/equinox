import mongoose, { Schema, Document } from 'mongoose';

export interface IPokemonSet extends Document {
  pokemonId?: string;
  pokemonName: string;      
  formId?: string;
  gameFamily?: string;
  gameVersion?: string;
  formatId: string;         
  regulationId?: string;
  battleStyle?: 'singles' | 'doubles';
  setId?: string;
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
  ivs?: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  moves: string[];          
  primaryRole?: string;
  secondaryRoles?: string[];
  archetypes?: string[];
  role: string;             
  synergyTags: string[];    
  sourceId?: string;
  sourceType?: string;
  sourceUpdatedAt?: Date;
  importedAt?: Date;
  confidence?: number;
  legal?: boolean;
  coherenceScore?: number;
  validationErrors?: string[];
  validationWarnings?: string[];
  status?: 'active' | 'verified' | 'reviewed' | 'deprecated' | 'quarantined' | 'draft';
  dataVersion?: string;
  contentHash?: string;
}

const PokemonSetSchema = new Schema<IPokemonSet>({
  pokemonId: { type: String, index: true },
  pokemonName: { type: String, required: true, index: true },
  formId: { type: String, index: true },
  gameFamily: { type: String },
  gameVersion: { type: String },
  formatId: { type: String, required: true, index: true },
  regulationId: { type: String, index: true },
  battleStyle: { type: String, enum: ['singles', 'doubles'] },
  setId: { type: String, index: true },
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
  ivs: {
    hp: { type: Number, default: 31 },
    atk: { type: Number, default: 31 },
    def: { type: Number, default: 31 },
    spa: { type: Number, default: 31 },
    spd: { type: Number, default: 31 },
    spe: { type: Number, default: 31 }
  },
  moves: [{ type: String, required: true }],
  primaryRole: { type: String },
  secondaryRoles: [{ type: String }],
  archetypes: [{ type: String }],
  role: { type: String, required: true },
  synergyTags: [{ type: String }],
  sourceId: { type: String, index: true },
  sourceType: { type: String },
  sourceUpdatedAt: { type: Date },
  importedAt: { type: Date, default: Date.now },
  confidence: { type: Number, min: 0, max: 100 },
  legal: { type: Boolean, default: false, index: true },
  coherenceScore: { type: Number, min: 0, max: 100 },
  validationErrors: [{ type: String }],
  validationWarnings: [{ type: String }],
  status: { type: String, enum: ['active', 'verified', 'reviewed', 'deprecated', 'quarantined', 'draft'], default: 'draft', index: true },
  dataVersion: { type: String },
  contentHash: { type: String }
});

PokemonSetSchema.index({ pokemonName: 1, formatId: 1 });
PokemonSetSchema.index({ pokemonId: 1, formId: 1, regulationId: 1, battleStyle: 1 });
PokemonSetSchema.index({ formatId: 1, status: 1, legal: 1, confidence: -1 });
PokemonSetSchema.index({ setId: 1, dataVersion: 1 }, { unique: true, sparse: true });

export const PokemonSet = mongoose.model<IPokemonSet>('PokemonSet', PokemonSetSchema);
