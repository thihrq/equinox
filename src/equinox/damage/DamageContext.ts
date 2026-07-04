import { PokemonData } from '../core/AnalysisContext';
import { Threat } from '../threats/Threat';

export interface DamageContext {
  team: PokemonData[];
  threats: Threat[];
  format: string;
  hasSpeedControl: boolean;
}
